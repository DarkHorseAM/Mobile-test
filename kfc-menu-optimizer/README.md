# KFC (Just Eat) menu optimiser

**Live data**: `menu.json` holds 148 real items and prices captured on-device
from the Just Eat menu page on 2026-08-20 (raw capture in `captures/`). Note
the capture came from the **KFC Loughton** branch — Just Eat switched branch
by delivery address; Halifax prices may differ slightly. The menu is loaded
into the page by XHR after render (it is NOT in `__NEXT_DATA__` or any inline
script), so it was captured with a DOM-collector bookmarklet run on a phone,
then normalised by `fetch_menu.py --json-file` and enriched by
`derive_provides.py`, which encodes only what item names state (": N pc"
counts, Meal = +fries +drink, cans/bottles = drink). On top of that,
`bucket_contents.json` pins exact bucket/feast compositions — fries counts,
wings, popcorn, side and bottle choices — from kfc.co.uk's own menu pages
(checked 2026-08-20), with a per-item `confidence` flag: `official` when the
page states it, `inferred` when a sibling size/variant's official composition
was extended. Feast side/drink choices are modelled as modifier groups, so
the ILP picks the sides that cover your wants. The matcher also treats a
"large" portion as satisfying a regular want (never the reverse).

Rebuild from a fresh capture:

```bash
python3 fetch_menu.py --json-file captures/<capture>.json --out menu.json
python3 derive_provides.py menu.json
python3 optimize.py --menu menu.json "zinger burger" "2x fries" gravy drink
```


Two parts:

1. **`fetch_menu.py`** — scrapes the Just Eat menu page for KFC Halifax into a
   normalised `menu.json`.
2. **`optimize.py`** — a PuLP integer-programming optimiser that, given a list
   of wanted items, returns the cheapest combination of purchasable menu items
   (including bundles/meals and their modifier options) covering the list.

## Findings from live probing (2026-08-20)

With egress to the Just Eat domains enabled, probing from this (datacenter)
environment established:

- Every `*.just-eat.co.uk` host is behind Cloudflare bot protection that
  hard-blocks datacenter IPs — curl gets an "Attention Required" 403 and even
  real Chromium via Playwright gets `ERR_CONNECTION_RESET`. From residential
  IPs (a phone/home connection) the pages load normally, so `fetch_menu.py`
  works as designed when run from a normal connection.
- The API domain `uk.api.just-eat.io` is NOT blocked. Unauthenticated:
  `GET /discovery/uk/restaurants/enriched/bypostcode/{POSTCODE}` →
  restaurant listing; KFC Halifax is id `70112`, uniqueName `kfc-halifax`
  (81 Haley Hill, HX3 6ED).
- `GET /restaurants/uk/kfc-halifax/menu` exists but returns
  `401 Authentication required` — it wants a bearer token from Just Eat's
  app auth flow, so it isn't usable anonymously.
- If fetching from a machine that can't pass Cloudflare, capture the page on
  a phone instead and feed it in: `--html-file page.html` (saved page /
  view-source copy) or `--json-file next_data.json` (the `__NEXT_DATA__`
  blob or a menu XHR body) — both skip all network access.

## Important: network access

The sandbox this was developed in **blocks all egress to
`www.just-eat.co.uk`** (the proxy refuses the CONNECT tunnel for curl,
WebFetch, and Playwright alike), so it was not possible to check from here
whether the live page embeds its menu in `__NEXT_DATA__` or another inline
script. `fetch_menu.py` therefore implements **both** paths and picks
automatically at runtime:

1. Plain HTTP GET → scan inline scripts: `__NEXT_DATA__`,
   `window.__INITIAL_STATE__` / `__PRELOADED_STATE__` / `__NUXT__` /
   `__APOLLO_STATE__`, and `application/ld+json`.
2. If nothing usable is embedded → Playwright loads the page and captures
   JSON XHR/fetch responses whose URL looks menu-shaped
   (`menu|catalogue|item|product`).

Every raw payload is also written to `raw_capture.json`; the item/modifier
normaliser is heuristic (it recursively finds name+price structures), so if
the live payload shape defeats it, tune the heuristics against that file.

Run it from a machine with normal internet access:

```bash
pip install requests playwright pulp
playwright install chromium   # only needed for the fallback path
python3 fetch_menu.py --out menu.json
```

`sample_menu.json` is a representative hand-written menu (labelled as such)
used to develop and test the optimiser; prices are not live.

## menu.json schema

```jsonc
{
  "items": [
    {
      "id": "zinger-meal",
      "name": "Zinger Burger Meal",
      "price": 8.49,                       // pounds
      "modifier_groups": ["drink-choice"], // ids into modifier_groups
      "provides": {"zinger_burger": 1, "regular_fries": 1}  // optional; bundles
    }
  ],
  "modifier_groups": [
    {
      "id": "drink-choice", "name": "Choose your drink",
      "min": 1, "max": 1,
      "options": [
        {"id": "opt-pepsi", "name": "Pepsi Max", "price_delta": 0.0,
         "provides": {"drink": 1}}         // optional
      ]
    }
  ]
}
```

`provides` maps an item (or modifier option) to the canonical components it
supplies — that's how a bucket can cover eight "chicken piece" wants. When
`provides` is absent, an item provides 1 unit of its own normalised name.
The scraper cannot infer `provides` for bundles automatically; add those maps
by hand (or from item descriptions) for bundle-aware optimisation. Without
them, bundles still optimise as whole named items.

## The optimiser

Integer program (CBC via PuLP):

- `x[i] ∈ ℤ≥0` — copies of menu item *i* bought
- `y[i,g,o] ∈ ℤ≥0` — times option *o* of modifier group *g* is chosen across
  the `x[i]` copies
- minimise `Σ price·x + Σ price_delta·y`
- per item/group: `min_g·x[i] ≤ Σ_o y[i,g,o] ≤ max_g·x[i]`
- per wanted component *w*: total provided by items + chosen options ≥ wanted

```bash
python3 optimize.py --menu sample_menu.json "zinger burger" "2x regular fries" gravy
# Cheapest basket:
#   1 x Zinger Burger        £5.99
#   2 x Regular Fries        £4.58
#   1 x Regular Gravy        £1.79
#   TOTAL                    £12.36

python3 optimize.py --menu sample_menu.json "3x mini fillet" "popcorn chicken" "regular fries" gravy drink
# Picks a single Boneless Banquet (£9.49) with gravy as the free side —
# the ILP uses modifier options for coverage, not just whole items.
```

Wants accept `"2x fries"` / `"2 x fries"` prefixes, fuzzy-match against
component keys and item names, and can come from a file (`--wants wants.txt`,
one per line, `#` comments). `--json` emits the machine-readable result.
