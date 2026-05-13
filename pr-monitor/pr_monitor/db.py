"""SQLite layer for the PR Campaign Monitor.

The schema is intentionally flat: one row per (article, matched pattern) so the
UI can group/aggregate by pattern without re-running regex. Articles are deduped
by URL via the unique index on ``articles.url``.
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, Iterator

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "monitor.db"


SCHEMA = """
CREATE TABLE IF NOT EXISTS articles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    url             TEXT NOT NULL UNIQUE,
    outlet          TEXT NOT NULL,
    outlet_tier     TEXT,
    headline        TEXT NOT NULL,
    summary         TEXT,
    published_at    TEXT,
    fetched_at      TEXT NOT NULL,
    brand           TEXT
);

CREATE INDEX IF NOT EXISTS idx_articles_outlet      ON articles(outlet);
CREATE INDEX IF NOT EXISTS idx_articles_published   ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_brand       ON articles(brand);

CREATE TABLE IF NOT EXISTS matches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    pattern_id      TEXT NOT NULL,
    pattern_label   TEXT,
    snippet         TEXT,
    UNIQUE(article_id, pattern_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_pattern  ON matches(pattern_id);
CREATE INDEX IF NOT EXISTS idx_matches_article  ON matches(article_id);

CREATE TABLE IF NOT EXISTS scan_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at      TEXT NOT NULL,
    finished_at     TEXT,
    feeds_scanned   INTEGER DEFAULT 0,
    articles_seen   INTEGER DEFAULT 0,
    articles_new    INTEGER DEFAULT 0,
    matches_new     INTEGER DEFAULT 0,
    errors          TEXT
);
"""


def connect(db_path: Path | str | None = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path else DEFAULT_DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    with conn:
        conn.executescript(SCHEMA)


@contextmanager
def session(db_path: Path | str | None = None) -> Iterator[sqlite3.Connection]:
    conn = connect(db_path)
    try:
        init_db(conn)
        yield conn
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------


def upsert_article(
    conn: sqlite3.Connection,
    *,
    url: str,
    outlet: str,
    outlet_tier: str | None,
    headline: str,
    summary: str | None,
    published_at: str | None,
    brand: str | None,
) -> tuple[int, bool]:
    """Insert or fetch an article row. Returns (article_id, is_new)."""
    existing = conn.execute(
        "SELECT id, brand FROM articles WHERE url = ?", (url,)
    ).fetchone()
    if existing is not None:
        if brand and not existing["brand"]:
            conn.execute(
                "UPDATE articles SET brand = ? WHERE id = ?", (brand, existing["id"])
            )
        return int(existing["id"]), False

    cur = conn.execute(
        """
        INSERT INTO articles (url, outlet, outlet_tier, headline, summary,
                              published_at, fetched_at, brand)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            url,
            outlet,
            outlet_tier,
            headline,
            summary,
            published_at,
            datetime.utcnow().isoformat(timespec="seconds"),
            brand,
        ),
    )
    return int(cur.lastrowid), True


def record_match(
    conn: sqlite3.Connection,
    *,
    article_id: int,
    pattern_id: str,
    pattern_label: str | None,
    snippet: str | None,
) -> bool:
    """Record a (article, pattern) match. Returns True if newly inserted."""
    cur = conn.execute(
        """
        INSERT OR IGNORE INTO matches (article_id, pattern_id, pattern_label, snippet)
        VALUES (?, ?, ?, ?)
        """,
        (article_id, pattern_id, pattern_label, snippet),
    )
    return cur.rowcount > 0


def start_scan_run(conn: sqlite3.Connection) -> int:
    cur = conn.execute(
        "INSERT INTO scan_runs (started_at) VALUES (?)",
        (datetime.utcnow().isoformat(timespec="seconds"),),
    )
    return int(cur.lastrowid)


def finish_scan_run(
    conn: sqlite3.Connection,
    run_id: int,
    *,
    feeds_scanned: int,
    articles_seen: int,
    articles_new: int,
    matches_new: int,
    errors: str | None,
) -> None:
    conn.execute(
        """
        UPDATE scan_runs
           SET finished_at   = ?,
               feeds_scanned = ?,
               articles_seen = ?,
               articles_new  = ?,
               matches_new   = ?,
               errors        = ?
         WHERE id = ?
        """,
        (
            datetime.utcnow().isoformat(timespec="seconds"),
            feeds_scanned,
            articles_seen,
            articles_new,
            matches_new,
            errors,
            run_id,
        ),
    )


# ---------------------------------------------------------------------------
# Reads — used by the Streamlit UI
# ---------------------------------------------------------------------------


def fetch_matches(
    conn: sqlite3.Connection,
    *,
    outlets: Iterable[str] | None = None,
    pattern_ids: Iterable[str] | None = None,
    brands: Iterable[str] | None = None,
    search: str | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    limit: int = 1000,
) -> list[sqlite3.Row]:
    """Return joined article+match rows for the browse view."""
    sql = [
        """
        SELECT
            a.id            AS article_id,
            a.url           AS url,
            a.outlet        AS outlet,
            a.outlet_tier   AS outlet_tier,
            a.headline      AS headline,
            a.summary       AS summary,
            a.published_at  AS published_at,
            a.fetched_at    AS fetched_at,
            a.brand         AS brand,
            m.pattern_id    AS pattern_id,
            m.pattern_label AS pattern_label,
            m.snippet       AS snippet
        FROM matches m
        JOIN articles a ON a.id = m.article_id
        """
    ]
    params: list = []
    where: list[str] = []

    if outlets:
        placeholders = ",".join("?" for _ in outlets)
        where.append(f"a.outlet IN ({placeholders})")
        params.extend(outlets)
    if pattern_ids:
        placeholders = ",".join("?" for _ in pattern_ids)
        where.append(f"m.pattern_id IN ({placeholders})")
        params.extend(pattern_ids)
    if brands:
        placeholders = ",".join("?" for _ in brands)
        where.append(f"a.brand IN ({placeholders})")
        params.extend(brands)
    if search:
        where.append("(a.headline LIKE ? OR a.summary LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like])
    if since:
        where.append("COALESCE(a.published_at, a.fetched_at) >= ?")
        params.append(since.isoformat(timespec="seconds"))
    if until:
        where.append("COALESCE(a.published_at, a.fetched_at) <= ?")
        params.append(until.isoformat(timespec="seconds"))

    if where:
        sql.append("WHERE " + " AND ".join(where))
    sql.append("ORDER BY COALESCE(a.published_at, a.fetched_at) DESC")
    sql.append("LIMIT ?")
    params.append(limit)

    return conn.execute("\n".join(sql), params).fetchall()


def distinct_outlets(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute("SELECT DISTINCT outlet FROM articles ORDER BY outlet").fetchall()
    return [r["outlet"] for r in rows]


def distinct_patterns(conn: sqlite3.Connection) -> list[tuple[str, str]]:
    rows = conn.execute(
        """
        SELECT DISTINCT pattern_id, COALESCE(pattern_label, pattern_id) AS label
          FROM matches
         ORDER BY label
        """
    ).fetchall()
    return [(r["pattern_id"], r["label"]) for r in rows]


def distinct_brands(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        "SELECT DISTINCT brand FROM articles WHERE brand IS NOT NULL ORDER BY brand"
    ).fetchall()
    return [r["brand"] for r in rows]


def top_brands(
    conn: sqlite3.Connection, *, since: datetime, limit: int = 20
) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT brand, COUNT(*) AS hits
          FROM articles
         WHERE brand IS NOT NULL
           AND COALESCE(published_at, fetched_at) >= ?
         GROUP BY brand
         ORDER BY hits DESC, brand
         LIMIT ?
        """,
        (since.isoformat(timespec="seconds"), limit),
    ).fetchall()


def top_patterns(
    conn: sqlite3.Connection, *, since: datetime, limit: int = 20
) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT m.pattern_id,
               COALESCE(m.pattern_label, m.pattern_id) AS label,
               COUNT(*) AS hits
          FROM matches m
          JOIN articles a ON a.id = m.article_id
         WHERE COALESCE(a.published_at, a.fetched_at) >= ?
         GROUP BY m.pattern_id
         ORDER BY hits DESC, label
         LIMIT ?
        """,
        (since.isoformat(timespec="seconds"), limit),
    ).fetchall()


def top_outlets(
    conn: sqlite3.Connection, *, since: datetime, limit: int = 20
) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT a.outlet, COUNT(DISTINCT a.id) AS hits
          FROM articles a
          JOIN matches m ON m.article_id = a.id
         WHERE COALESCE(a.published_at, a.fetched_at) >= ?
         GROUP BY a.outlet
         ORDER BY hits DESC, a.outlet
         LIMIT ?
        """,
        (since.isoformat(timespec="seconds"), limit),
    ).fetchall()


def pattern_trend(
    conn: sqlite3.Connection, *, this_week_start: datetime
) -> list[sqlite3.Row]:
    """Compare pattern hits this week vs the previous week."""
    last_week_start = this_week_start - timedelta(days=7)
    return conn.execute(
        """
        SELECT m.pattern_id,
               COALESCE(m.pattern_label, m.pattern_id) AS label,
               SUM(CASE WHEN COALESCE(a.published_at, a.fetched_at) >= ?
                        THEN 1 ELSE 0 END) AS hits_this_week,
               SUM(CASE WHEN COALESCE(a.published_at, a.fetched_at) >= ?
                         AND COALESCE(a.published_at, a.fetched_at) <  ?
                        THEN 1 ELSE 0 END) AS hits_last_week
          FROM matches m
          JOIN articles a ON a.id = m.article_id
         WHERE COALESCE(a.published_at, a.fetched_at) >= ?
         GROUP BY m.pattern_id
         ORDER BY hits_this_week DESC, label
        """,
        (
            this_week_start.isoformat(timespec="seconds"),
            last_week_start.isoformat(timespec="seconds"),
            this_week_start.isoformat(timespec="seconds"),
            last_week_start.isoformat(timespec="seconds"),
        ),
    ).fetchall()


def headline_words(
    conn: sqlite3.Connection, *, since: datetime, limit: int = 2000
) -> list[str]:
    """Return raw headline strings for the requested window — caller tokenises."""
    rows = conn.execute(
        """
        SELECT DISTINCT a.headline
          FROM articles a
          JOIN matches m ON m.article_id = a.id
         WHERE COALESCE(a.published_at, a.fetched_at) >= ?
         LIMIT ?
        """,
        (since.isoformat(timespec="seconds"), limit),
    ).fetchall()
    return [r["headline"] for r in rows]


def last_scan_run(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM scan_runs ORDER BY id DESC LIMIT 1"
    ).fetchone()
