"""Scanner — fetch configured RSS feeds, match PR-indicator patterns, persist.

Run directly:
    python -m pr_monitor.scanner

Or with overrides:
    python -m pr_monitor.scanner --feeds config/feeds.yaml \
        --patterns config/patterns.yaml --db data/monitor.db
"""
from __future__ import annotations

import argparse
import logging
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from html import unescape
from pathlib import Path
from time import mktime
from typing import Iterable

import feedparser
import yaml

from . import db

LOG = logging.getLogger("pr_monitor.scanner")

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_FEEDS = ROOT / "config" / "feeds.yaml"
DEFAULT_PATTERNS = ROOT / "config" / "patterns.yaml"

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Feed:
    name: str
    url: str
    tier: str | None = None


@dataclass(frozen=True)
class Pattern:
    id: str
    label: str
    regex: re.Pattern[str]


@dataclass(frozen=True)
class BrandExtractor:
    id: str
    regex: re.Pattern[str]


def load_feeds(path: Path | str = DEFAULT_FEEDS) -> list[Feed]:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    feeds = []
    for entry in data.get("feeds", []):
        if not entry.get("url") or not entry.get("name"):
            LOG.warning("Skipping malformed feed entry: %r", entry)
            continue
        feeds.append(Feed(name=entry["name"], url=entry["url"], tier=entry.get("tier")))
    return feeds


def load_patterns(
    path: Path | str = DEFAULT_PATTERNS,
) -> tuple[list[Pattern], list[BrandExtractor]]:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    flags = re.IGNORECASE

    indicators: list[Pattern] = []
    for entry in data.get("indicators", []):
        try:
            indicators.append(
                Pattern(
                    id=entry["id"],
                    label=entry.get("label", entry["id"]),
                    regex=re.compile(entry["regex"], flags),
                )
            )
        except (KeyError, re.error) as exc:
            LOG.warning("Skipping bad indicator %r: %s", entry, exc)

    brand_extractors: list[BrandExtractor] = []
    for entry in data.get("brand_extractors", []):
        try:
            brand_extractors.append(
                BrandExtractor(
                    id=entry["id"],
                    regex=re.compile(entry["regex"], flags),
                )
            )
        except (KeyError, re.error) as exc:
            LOG.warning("Skipping bad brand extractor %r: %s", entry, exc)

    return indicators, brand_extractors


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------


def clean_text(raw: str | None) -> str:
    if not raw:
        return ""
    return _WS_RE.sub(" ", unescape(_TAG_RE.sub(" ", raw))).strip()


def published_iso(entry) -> str | None:
    for key in ("published_parsed", "updated_parsed"):
        struct = getattr(entry, key, None) or entry.get(key)
        if struct:
            try:
                return datetime.utcfromtimestamp(mktime(struct)).isoformat(
                    timespec="seconds"
                )
            except (TypeError, ValueError, OverflowError):
                continue
    return None


def snippet_around(text: str, match: re.Match[str], radius: int = 80) -> str:
    start = max(0, match.start() - radius)
    end = min(len(text), match.end() + radius)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"


def extract_brand(
    text: str, extractors: Iterable[BrandExtractor]
) -> str | None:
    for ext in extractors:
        m = ext.regex.search(text)
        if not m or not m.groups():
            continue
        brand = _WS_RE.sub(" ", m.group(1)).strip(" .,;:'\"")
        # Trim trailing throwaway tokens that often slip in via lazy captures.
        brand = re.sub(
            r"\s+(?:has|have|said|says|today|yesterday|this week)$",
            "",
            brand,
            flags=re.IGNORECASE,
        ).strip()
        if 2 <= len(brand) <= 80:
            return brand
    return None


def match_indicators(
    text: str, patterns: Iterable[Pattern]
) -> list[tuple[Pattern, str]]:
    hits = []
    for p in patterns:
        m = p.regex.search(text)
        if m:
            hits.append((p, snippet_around(text, m)))
    return hits


# ---------------------------------------------------------------------------
# Per-feed processing
# ---------------------------------------------------------------------------


@dataclass
class ScanStats:
    feeds_scanned: int = 0
    articles_seen: int = 0
    articles_new: int = 0
    matches_new: int = 0
    errors: list[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.errors is None:
            self.errors = []


def process_feed(
    conn,
    feed: Feed,
    indicators: list[Pattern],
    brand_extractors: list[BrandExtractor],
    stats: ScanStats,
) -> None:
    LOG.info("Fetching %s (%s)", feed.name, feed.url)
    try:
        parsed = feedparser.parse(feed.url)
    except Exception as exc:  # noqa: BLE001 — feedparser is fairly permissive
        msg = f"{feed.name}: fetch failed: {exc}"
        LOG.warning(msg)
        stats.errors.append(msg)
        return

    if getattr(parsed, "bozo", False) and not parsed.entries:
        msg = f"{feed.name}: feed parse error: {getattr(parsed, 'bozo_exception', '')}"
        LOG.warning(msg)
        stats.errors.append(msg)
        return

    stats.feeds_scanned += 1

    for entry in parsed.entries:
        stats.articles_seen += 1
        url = entry.get("link")
        headline = clean_text(entry.get("title"))
        summary = clean_text(entry.get("summary") or entry.get("description"))
        if not url or not headline:
            continue

        haystack = f"{headline}. {summary}".strip()
        hits = match_indicators(haystack, indicators)
        if not hits:
            continue

        brand = extract_brand(haystack, brand_extractors)
        article_id, is_new = db.upsert_article(
            conn,
            url=url,
            outlet=feed.name,
            outlet_tier=feed.tier,
            headline=headline,
            summary=summary,
            published_at=published_iso(entry),
            brand=brand,
        )
        if is_new:
            stats.articles_new += 1

        for pattern, snippet in hits:
            inserted = db.record_match(
                conn,
                article_id=article_id,
                pattern_id=pattern.id,
                pattern_label=pattern.label,
                snippet=snippet,
            )
            if inserted:
                stats.matches_new += 1


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def run_scan(
    *,
    feeds_path: Path | str = DEFAULT_FEEDS,
    patterns_path: Path | str = DEFAULT_PATTERNS,
    db_path: Path | str | None = None,
) -> ScanStats:
    feeds = load_feeds(feeds_path)
    indicators, brand_extractors = load_patterns(patterns_path)
    LOG.info(
        "Loaded %d feeds, %d indicator patterns, %d brand extractors",
        len(feeds),
        len(indicators),
        len(brand_extractors),
    )
    stats = ScanStats()

    with db.session(db_path) as conn:
        run_id = db.start_scan_run(conn)
        try:
            for feed in feeds:
                process_feed(conn, feed, indicators, brand_extractors, stats)
                conn.commit()
        finally:
            db.finish_scan_run(
                conn,
                run_id,
                feeds_scanned=stats.feeds_scanned,
                articles_seen=stats.articles_seen,
                articles_new=stats.articles_new,
                matches_new=stats.matches_new,
                errors="\n".join(stats.errors) or None,
            )
            conn.commit()
    return stats


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Scan UK news feeds for PR-originated coverage.")
    p.add_argument("--feeds", default=str(DEFAULT_FEEDS), help="Path to feeds.yaml")
    p.add_argument("--patterns", default=str(DEFAULT_PATTERNS), help="Path to patterns.yaml")
    p.add_argument("--db", default=None, help="Path to SQLite DB (default: data/monitor.db)")
    p.add_argument("-v", "--verbose", action="store_true")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _build_arg_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    stats = run_scan(
        feeds_path=args.feeds,
        patterns_path=args.patterns,
        db_path=args.db,
    )
    LOG.info(
        "Scan complete: %d feeds, %d articles seen, %d new, %d new matches, %d errors",
        stats.feeds_scanned,
        stats.articles_seen,
        stats.articles_new,
        stats.matches_new,
        len(stats.errors),
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
