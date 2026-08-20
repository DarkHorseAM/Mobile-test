#!/usr/bin/env python3
"""Cheapest-basket optimiser over a Just Eat menu.json.

Given a list of wanted things ("2x chicken piece", "zinger burger", "gravy"),
solve an integer program that picks the cheapest combination of purchasable
menu items — including bundles/meals whose contents or modifier options cover
wanted things — such that every wanted thing is covered at least the
requested number of times.

Model
-----
Variables:
    x[i]      >= 0 integer   copies of menu item i bought
    y[i,g,o]  >= 0 integer   times option o of modifier group g is chosen
                             across the x[i] copies of item i

Objective:
    minimise  sum(price[i] * x[i]) + sum(price_delta[o] * y[i,g,o])

Constraints:
    per item i, group g:   min_g * x[i] <= sum_o y[i,g,o] <= max_g * x[i]
    per wanted component w:
        sum_i provides[i][w] * x[i] + sum_{i,g,o} provides[o][w] * y[i,g,o]
            >= wanted[w]

Coverage ("provides") comes from an explicit "provides" map on items/options
when present (bundles), otherwise an item provides 1 unit of its own
normalised name. Wanted names are matched fuzzily against component keys and
item names.

Usage:
    python3 optimize.py --menu menu.json "zinger burger" "2x regular fries" gravy
    python3 optimize.py --menu menu.json --wants wants.txt
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import pulp


def norm(s: str) -> str:
    """Normalise a name to a component key: lowercase, snake_case, singular-ish."""
    s = re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")
    return s


def tokens(s: str) -> set[str]:
    STOP = {"of", "the", "a", "an", "x", "piece", "pieces", "portion", "regular"}
    return {t.rstrip("s") for t in norm(s).split("_") if t and t not in STOP}


class Menu:
    def __init__(self, data: dict):
        self.data = data
        self.items = data.get("items", [])
        self.groups = {g["id"]: g for g in data.get("modifier_groups", [])}

    def item_provides(self, item: dict) -> dict[str, int]:
        explicit = item.get("provides")
        if explicit:
            return {norm(k): int(v) for k, v in explicit.items()}
        return {norm(item["name"]): 1}

    @staticmethod
    def option_provides(opt: dict) -> dict[str, int]:
        explicit = opt.get("provides")
        if explicit:
            return {norm(k): int(v) for k, v in explicit.items()}
        return {norm(opt["name"]): 1}

    def all_component_keys(self) -> set[str]:
        keys: set[str] = set()
        for it in self.items:
            keys |= set(self.item_provides(it))
        for g in self.groups.values():
            for o in g["options"]:
                keys |= set(self.option_provides(o))
        return keys


def parse_wants(raw_wants: list[str]) -> dict[str, int]:
    """Parse entries like "2x fries", "3 x gravy", or plain "zinger burger"."""
    wants: dict[str, int] = {}
    for w in raw_wants:
        m = re.match(r"^\s*(\d+)\s*[xX]?\s+(.*)$", w)
        if m:
            count, name = int(m.group(1)), m.group(2)
        else:
            count, name = 1, w
        key = norm(name)
        wants[key] = wants.get(key, 0) + count
    return wants


def match_components(want: str, component_keys: set[str]) -> list[str]:
    """Map a wanted name onto the menu component keys that satisfy it.

    Picks the closest key by token overlap (every wanted token must be
    present, fewest extras wins), then also accepts its "large" size-upgrade
    sibling — a Large Gravy always satisfies a plain "gravy" want, but a
    regular one never satisfies an explicit "large gravy" want.
    """
    if want in component_keys:
        best_tokens = tokens(want)
        matched = {want}
    else:
        wt = tokens(want)
        if not wt:
            return []
        best, best_extra = None, None
        for key in component_keys:
            kt = tokens(key)
            if wt <= kt:
                extra = len(kt - wt)
                if best is None or extra < best_extra:
                    best, best_extra = key, extra
        if best is None:
            return []
        best_tokens = tokens(best)
        matched = {best}
    upgraded = best_tokens | {"large"}
    for key in component_keys:
        kt = tokens(key)
        if kt == best_tokens or kt == upgraded:
            matched.add(key)
    return sorted(matched)


def solve(menu: Menu, wants: dict[str, int], verbose: bool = False) -> dict:
    component_keys = menu.all_component_keys()

    resolved: dict[tuple[str, ...], int] = {}
    unmatched: list[str] = []
    for want, count in wants.items():
        keys = match_components(want, component_keys)
        if not keys:
            unmatched.append(want)
        else:
            group = tuple(keys)
            resolved[group] = resolved.get(group, 0) + count
    if unmatched:
        return {"status": "unmatched_wants", "unmatched": unmatched,
                "known_components": sorted(component_keys)}

    prob = pulp.LpProblem("cheapest_kfc_basket", pulp.LpMinimize)

    x = {
        it["id"]: pulp.LpVariable(f"x_{it['id']}", lowBound=0, cat="Integer")
        for it in menu.items
    }
    # y[(item_id, group_id, option_id)]
    y: dict[tuple[str, str, str], pulp.LpVariable] = {}
    for it in menu.items:
        for gid in it.get("modifier_groups", []):
            g = menu.groups.get(gid)
            if not g:
                continue
            for o in g["options"]:
                y[(it["id"], gid, o["id"])] = pulp.LpVariable(
                    f"y_{it['id']}_{gid}_{o['id']}", lowBound=0, cat="Integer")

    # Objective
    cost = pulp.lpSum(it["price"] * x[it["id"]] for it in menu.items)
    for it in menu.items:
        for gid in it.get("modifier_groups", []):
            g = menu.groups.get(gid)
            if not g:
                continue
            cost += pulp.lpSum(
                o.get("price_delta", 0.0) * y[(it["id"], gid, o["id"])]
                for o in g["options"])
    prob += cost

    # Modifier-group choice counts must track the number of copies bought.
    for it in menu.items:
        for gid in it.get("modifier_groups", []):
            g = menu.groups.get(gid)
            if not g:
                continue
            chosen = pulp.lpSum(y[(it["id"], gid, o["id"])] for o in g["options"])
            prob += chosen >= g.get("min", 0) * x[it["id"]], f"min_{it['id']}_{gid}"
            prob += chosen <= g.get("max", 1) * x[it["id"]], f"max_{it['id']}_{gid}"

    # Coverage constraints — any component in a want's matched group counts.
    for comps, needed in resolved.items():
        supply = pulp.lpSum(
            sum(menu.item_provides(it).get(c, 0) for c in comps) * x[it["id"]]
            for it in menu.items)
        for it in menu.items:
            for gid in it.get("modifier_groups", []):
                g = menu.groups.get(gid)
                if not g:
                    continue
                supply += pulp.lpSum(
                    sum(menu.option_provides(o).get(c, 0) for c in comps)
                    * y[(it["id"], gid, o["id"])]
                    for o in g["options"])
        prob += supply >= needed, f"cover_{'_or_'.join(comps)}"

    status = prob.solve(pulp.PULP_CBC_CMD(msg=verbose))
    if pulp.LpStatus[status] != "Optimal":
        return {"status": pulp.LpStatus[status]}

    basket = []
    for it in menu.items:
        qty = int(round(x[it["id"]].value() or 0))
        if qty <= 0:
            continue
        chosen_opts = []
        for gid in it.get("modifier_groups", []):
            g = menu.groups.get(gid)
            if not g:
                continue
            for o in g["options"]:
                oq = int(round(y[(it["id"], gid, o["id"])].value() or 0))
                if oq > 0:
                    chosen_opts.append({
                        "group": g["name"], "option": o["name"],
                        "qty": oq, "price_delta": o.get("price_delta", 0.0)})
        basket.append({
            "item": it["name"], "qty": qty, "unit_price": it["price"],
            "line_total": round(it["price"] * qty
                                + sum(c["qty"] * c["price_delta"] for c in chosen_opts), 2),
            "options": chosen_opts,
        })

    return {
        "status": "Optimal",
        "wants": {" | ".join(k): v for k, v in resolved.items()},
        "basket": basket,
        "total": round(pulp.value(prob.objective), 2),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("wants", nargs="*", help='e.g. "zinger burger" "2x regular fries" gravy')
    ap.add_argument("--menu", default="menu.json", help="Path to menu.json")
    ap.add_argument("--wants", dest="wants_file", default=None,
                    help="File with one wanted item per line")
    ap.add_argument("--json", action="store_true", help="Emit raw JSON result")
    ap.add_argument("--verbose", action="store_true", help="Show CBC solver output")
    args = ap.parse_args()

    raw_wants = list(args.wants)
    if args.wants_file:
        raw_wants += [ln.strip() for ln in Path(args.wants_file).read_text().splitlines()
                      if ln.strip() and not ln.startswith("#")]
    if not raw_wants:
        ap.error("no wanted items given")

    menu = Menu(json.loads(Path(args.menu).read_text()))
    result = solve(menu, parse_wants(raw_wants), verbose=args.verbose)

    if args.json:
        print(json.dumps(result, indent=2))
        return 0 if result["status"] == "Optimal" else 1

    if result["status"] == "unmatched_wants":
        print("Could not match these wanted items to anything on the menu:",
              file=sys.stderr)
        for w in result["unmatched"]:
            print(f"  - {w}", file=sys.stderr)
        print("\nKnown components:", ", ".join(result["known_components"]),
              file=sys.stderr)
        return 1
    if result["status"] != "Optimal":
        print(f"Solver finished with status: {result['status']}", file=sys.stderr)
        return 1

    print("Cheapest basket:")
    for line in result["basket"]:
        print(f"  {line['qty']} x {line['item']:<40} £{line['line_total']:.2f}")
        for opt in line["options"]:
            delta = f" (+£{opt['price_delta']:.2f})" if opt["price_delta"] else ""
            print(f"      -> {opt['qty']} x {opt['option']}{delta} [{opt['group']}]")
    print(f"  {'TOTAL':>44} £{result['total']:.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
