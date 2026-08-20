#!/usr/bin/env python3
"""Derive `provides` maps for a captured KFC menu.json, in place.

Only encodes what an item's own name states, plus two well-established KFC
conventions, so the optimiser never gets invented bundle contents:

  - "<base>: N pc"           -> N units of the base thing. Bucket-family items
                                (Bargain Bucket, Family Feast, Party Bucket,
                                Wicked Variety Bucket, Dipping Feast, Colonel's)
                                count pieces of chicken (tenders for "Tenders"
                                variants); their fries/sides are NOT encoded.
  - "<base> Meal" / "Box Meal" -> base item + regular fries + a drink
                                (the standard KFC meal upgrade).
  - "<base> & Drink" / "with a Drink" -> base + drink.
  - "... with 1 Tender"      -> +1 tender.
  - cans / bottles / water   -> count as a generic `drink`.
  - "N Hot Wings"            -> N hot wings.

Everything else provides one unit of its own normalised name. Duplicate item
names keep their first occurrence (later ones are scrape artefacts).

Usage: python3 derive_provides.py menu.json
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from optimize import norm

BUCKET_FAMILIES = (
    "bargain bucket", "family feast", "party bucket", "wicked variety bucket",
    "dipping feast", "colonel's",
)

DRINK_RX = re.compile(r"\b(can|bottle|water)\b", re.I)
PC_RX = re.compile(r"^(?P<base>.*?):?\s*(?P<n>\d+)\s*pc\.?\s*$", re.I)
NWINGS_RX = re.compile(r"(\d+)\s+hot wings", re.I)


def clean(name: str) -> str:
    """Strip emoji and trailing decoration from an item name."""
    return re.sub(r"[^\x20-\x7E’']+", "", name).strip(" -")


def derive(name: str) -> dict[str, int]:
    n = clean(name)
    provides: dict[str, int] = {}
    lower = n.lower()

    is_meal = bool(re.search(r"\bmeal\b", lower))
    base = re.sub(r"\bbox meal\b|\bmeal\b", "", n, flags=re.I).strip(" :")

    extra_tender = 0
    m = re.search(r"\bwith (\d+) tender\b", base, re.I)
    if m:
        extra_tender = int(m.group(1))
        base = re.sub(r"\s*\bwith \d+ tender\b", "", base, flags=re.I).strip()

    wants_drink = bool(re.search(r"(&|\bwith a\b)\s*drink\b", lower))
    base = re.sub(r"\s*(&|\bwith a\b)\s*drink\b", "", base, flags=re.I).strip()

    m = NWINGS_RX.search(base)
    if m and "bucket" in lower:
        provides["hot_wing"] = int(m.group(1))
    else:
        m = PC_RX.match(base)
        if m:
            b, count = m.group("base").strip(), int(m.group("n"))
            bl = b.lower()
            if any(fam in bl for fam in BUCKET_FAMILIES):
                unit = "tender" if bl.startswith("tenders") else "chicken_piece"
                provides[unit] = count
                provides[norm(b)] = 1
            elif "hot wing" in bl:
                provides["hot_wing"] = count
            elif "original recipe chicken" in bl:
                provides["chicken_piece"] = count
            elif "tender" in bl:
                provides["tender"] = count
            else:
                provides[norm(b)] = count
        else:
            key = norm(base) if base else norm(n)
            if "original recipe chicken" in base.lower():
                provides["chicken_piece"] = provides.get("chicken_piece", 0) + 1
            provides[key] = provides.get(key, 0) + 1

    if extra_tender:
        provides["tender"] = provides.get("tender", 0) + extra_tender
    if is_meal:
        provides["regular_signature_fries"] = provides.get("regular_signature_fries", 0) + 1
        wants_drink = True
    if wants_drink or DRINK_RX.search(lower):
        provides["drink"] = provides.get("drink", 0) + 1

    return {k: v for k, v in provides.items() if k}


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "menu.json")
    menu = json.loads(path.read_text())

    seen: set[str] = set()
    items = []
    for it in menu["items"]:
        if it["name"] in seen:
            print(f"[derive] dropping duplicate scrape of {it['name']!r} "
                  f"at £{it['price']:.2f}")
            continue
        seen.add(it["name"])
        it["provides"] = derive(it["name"])
        items.append(it)
    menu["items"] = items

    path.write_text(json.dumps(menu, indent=2, ensure_ascii=False))
    print(f"[derive] wrote provides for {len(items)} items to {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
