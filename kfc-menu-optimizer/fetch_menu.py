#!/usr/bin/env python3
"""Fetch the Just Eat menu for KFC Halifax and write a normalised menu.json.

Strategy (in order):
  1. Plain HTTP GET of the menu page. Look for menu data embedded in inline
     scripts: <script id="__NEXT_DATA__">, window.__INITIAL_STATE__ /
     __PRELOADED_STATE__ assignments, or application/ld+json blocks.
  2. If no usable inline data is found, drive the page with Playwright and
     capture the menu XHR/fetch response(s) the client app makes.

Whatever raw payload is found is saved next to the output (raw_capture.json)
so the normaliser can be tuned against the real shape if the heuristics miss
anything.

Usage:
    python3 fetch_menu.py [--url URL] [--out menu.json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

DEFAULT_URL = "https://www.just-eat.co.uk/restaurants-kfc-halifax/menu"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

# Keys that mark a dict as looking like a sellable menu item.
NAME_KEYS = ("name", "title", "itemName", "Name")
PRICE_KEYS = (
    "price", "unitPrice", "basePrice", "amount", "priceInPence",
    "priceIncTax", "Price", "fromPrice",
)
MODIFIER_GROUP_KEYS = (
    "modifierGroups", "modifier_groups", "optionGroups", "variations",
    "accessories", "choices", "customisations",
)


# --------------------------------------------------------------------------
# Step 1: static HTML fetch + inline-script extraction
# --------------------------------------------------------------------------

def fetch_html(url: str) -> str | None:
    import requests

    try:
        resp = requests.get(
            url,
            headers={
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-GB,en;q=0.9",
            },
            timeout=30,
        )
    except requests.RequestException as exc:
        print(f"[fetch] HTTP fetch failed: {exc}", file=sys.stderr)
        return None
    if resp.status_code != 200:
        print(f"[fetch] HTTP {resp.status_code} for {url}", file=sys.stderr)
        return None
    return resp.text


def extract_inline_json(html: str) -> list[tuple[str, object]]:
    """Return (source-label, parsed-json) for every inline blob we can parse."""
    found: list[tuple[str, object]] = []

    m = re.search(
        r'<script[^>]*id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
        html, re.DOTALL,
    )
    if m:
        try:
            found.append(("__NEXT_DATA__", json.loads(m.group(1))))
        except json.JSONDecodeError:
            pass

    for var in ("__INITIAL_STATE__", "__PRELOADED_STATE__", "__NUXT__", "__APOLLO_STATE__"):
        m = re.search(
            rf'window\.{var}\s*=\s*(\{{.*?\}})\s*(?:;|</script>)',
            html, re.DOTALL,
        )
        if m:
            try:
                found.append((var, json.loads(m.group(1))))
            except json.JSONDecodeError:
                pass

    for m in re.finditer(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.DOTALL,
    ):
        try:
            found.append(("ld+json", json.loads(m.group(1))))
        except json.JSONDecodeError:
            pass

    return found


# --------------------------------------------------------------------------
# Step 2: Playwright fallback — capture the menu XHR
# --------------------------------------------------------------------------

def capture_menu_xhr(url: str, chromium_path: str | None = None) -> list[tuple[str, object]]:
    from playwright.sync_api import sync_playwright

    captures: list[tuple[str, object]] = []
    url_hint = re.compile(r"menu|catalogue|catalog|item|product|basket-info", re.I)

    with sync_playwright() as p:
        launch_kwargs = {"headless": True}
        if chromium_path:
            launch_kwargs["executable_path"] = chromium_path
        browser = p.chromium.launch(**launch_kwargs)
        page = browser.new_page(user_agent=UA)

        def on_response(resp):
            ctype = resp.headers.get("content-type", "")
            if "json" not in ctype or not url_hint.search(resp.url):
                return
            try:
                body = resp.json()
            except Exception:
                return
            captures.append((resp.url, body))

        page.on("response", on_response)
        page.goto(url, wait_until="networkidle", timeout=60000)
        # Give any lazy menu requests a moment to land.
        page.wait_for_timeout(3000)
        browser.close()

    return captures


# --------------------------------------------------------------------------
# Normalisation: dig menu items / modifier groups out of an arbitrary payload
# --------------------------------------------------------------------------

def _first_key(d: dict, keys) -> object | None:
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None


def _as_pounds(value) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        # Just Eat APIs often quote pence as integers; > 200 with no decimals
        # on a fast-food menu almost certainly means pence.
        if isinstance(value, int) and value >= 200:
            return round(value / 100.0, 2)
        return round(float(value), 2)
    if isinstance(value, dict):
        inner = _first_key(value, PRICE_KEYS + ("value",))
        return _as_pounds(inner) if inner is not None else None
    if isinstance(value, str):
        m = re.search(r"\d+(?:\.\d+)?", value)
        return round(float(m.group()), 2) if m else None
    return None


def _looks_like_item(d: dict) -> bool:
    return (
        _first_key(d, NAME_KEYS) is not None
        and _first_key(d, PRICE_KEYS) is not None
    )


def _walk(node, items: list[dict], groups: list[dict]):
    if isinstance(node, dict):
        is_item = _looks_like_item(node)
        if is_item:
            price = _as_pounds(_first_key(node, PRICE_KEYS))
            if price is not None:
                mg = _first_key(node, MODIFIER_GROUP_KEYS)
                mg = mg if isinstance(mg, list) else []
                items.append({
                    "id": str(node.get("id") or node.get("itemId") or len(items)),
                    "name": str(_first_key(node, NAME_KEYS)),
                    "description": str(node.get("description") or ""),
                    "price": price,
                    "category": str(node.get("category") or node.get("categoryName") or ""),
                    "modifier_groups": [
                        str(g.get("id") or g.get("groupId") or "")
                        for g in mg if isinstance(g, dict)
                    ],
                })
                for g in mg:
                    if isinstance(g, dict):
                        _collect_group(g, groups)
        for k, v in node.items():
            # Don't re-walk an item's modifier groups as if they were items —
            # their options would show up as standalone menu entries.
            if is_item and k in MODIFIER_GROUP_KEYS:
                continue
            _walk(v, items, groups)
    elif isinstance(node, list):
        for v in node:
            _walk(v, items, groups)


def _collect_group(g: dict, groups: list[dict]):
    opts_raw = g.get("options") or g.get("modifiers") or g.get("items") or []
    options = []
    for o in opts_raw:
        if not isinstance(o, dict):
            continue
        name = _first_key(o, NAME_KEYS)
        if name is None:
            continue
        delta = _as_pounds(_first_key(o, PRICE_KEYS)) or 0.0
        options.append({
            "id": str(o.get("id") or name),
            "name": str(name),
            "price_delta": delta,
        })
    if not options:
        return
    groups.append({
        "id": str(g.get("id") or g.get("groupId") or g.get("name") or len(groups)),
        "name": str(g.get("name") or ""),
        "min": int(g.get("minChoices") or g.get("min") or 0),
        "max": int(g.get("maxChoices") or g.get("max") or 1),
        "options": options,
    })


def normalise(payloads: list[tuple[str, object]], source_url: str) -> dict | None:
    best_items: list[dict] = []
    best_groups: list[dict] = []
    best_label = None
    for label, payload in payloads:
        items: list[dict] = []
        groups: list[dict] = []
        _walk(payload, items, groups)
        # Deduplicate by (name, price).
        seen, deduped = set(), []
        for it in items:
            key = (it["name"], it["price"])
            if key not in seen:
                seen.add(key)
                deduped.append(it)
        if len(deduped) > len(best_items):
            best_items, best_groups, best_label = deduped, groups, label

    if not best_items:
        return None

    seen_g, groups = set(), []
    for g in best_groups:
        if g["id"] not in seen_g:
            seen_g.add(g["id"])
            groups.append(g)

    return {
        "source": source_url,
        "extracted_from": best_label,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "restaurant": "KFC - Halifax (Just Eat)",
        "items": best_items,
        "modifier_groups": groups,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--out", default="menu.json")
    ap.add_argument("--chromium", default=None,
                    help="Path to a Chromium binary for the Playwright fallback")
    args = ap.parse_args()

    out = Path(args.out)
    raw_path = out.with_name("raw_capture.json")

    payloads: list[tuple[str, object]] = []

    html = fetch_html(args.url)
    if html:
        payloads = extract_inline_json(html)
        if payloads:
            print(f"[fetch] found inline script data: {[l for l, _ in payloads]}")
        else:
            print("[fetch] no parseable inline script data found in HTML")

    menu = normalise(payloads, args.url) if payloads else None

    if menu is None:
        print("[fetch] falling back to Playwright XHR capture...")
        captures = capture_menu_xhr(args.url, args.chromium)
        print(f"[fetch] captured {len(captures)} candidate JSON responses")
        payloads = captures
        menu = normalise(payloads, args.url)

    raw_path.write_text(json.dumps(
        [{"source": l, "payload": p} for l, p in payloads], indent=2)[:50_000_000])
    print(f"[fetch] raw payloads saved to {raw_path}")

    if menu is None:
        print("[fetch] FAILED: no menu items could be extracted. Inspect "
              f"{raw_path} and adjust the normaliser heuristics.", file=sys.stderr)
        return 1

    out.write_text(json.dumps(menu, indent=2))
    print(f"[fetch] wrote {len(menu['items'])} items and "
          f"{len(menu['modifier_groups'])} modifier groups to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
