// Exact cheapest-basket solver over a normalised menu.json — the JS port of
// optimize.py's integer program. Coverage demands are small, so instead of an
// ILP it runs memoised search over the clamped remaining-demand vector, which
// is exact for >= coverage with non-negative prices (excess supply is free).
// Prices are handled in pence to avoid float drift.

const STOP = new Set(["of", "the", "a", "an", "x", "piece", "pieces", "portion", "regular"]);

function norm(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function tokens(s) {
  const out = new Set();
  for (const t of norm(s).split("_")) {
    if (t && !STOP.has(t)) out.add(t.replace(/s+$/, ""));
  }
  return out;
}

const isSubset = (a, b) => [...a].every((t) => b.has(t));
const sameSet = (a, b) => a.size === b.size && isSubset(a, b);

function itemProvides(item) {
  if (item.provides && Object.keys(item.provides).length) {
    const out = {};
    for (const [k, v] of Object.entries(item.provides)) out[norm(k)] = v;
    return out;
  }
  return { [norm(item.name)]: 1 };
}

function optionProvides(opt) {
  if (opt.provides && Object.keys(opt.provides).length) {
    const out = {};
    for (const [k, v] of Object.entries(opt.provides)) out[norm(k)] = v;
    return out;
  }
  return { [norm(opt.name)]: 1 };
}

function allComponentKeys(menu) {
  const keys = new Set();
  for (const it of menu.items) for (const k of Object.keys(itemProvides(it))) keys.add(k);
  for (const g of menu.modifier_groups || [])
    for (const o of g.options) for (const k of Object.keys(optionProvides(o))) keys.add(k);
  return keys;
}

// Port of optimize.py match_components: best token match, plus its "large"
// size-upgrade sibling (large satisfies regular, never the reverse).
function matchComponents(want, componentKeys) {
  let bestTokens = null;
  const matched = new Set();
  if (componentKeys.has(want)) {
    bestTokens = tokens(want);
    matched.add(want);
  } else {
    const wt = tokens(want);
    if (!wt.size) return [];
    let best = null;
    let bestExtra = Infinity;
    for (const key of componentKeys) {
      const kt = tokens(key);
      if (isSubset(wt, kt)) {
        const extra = kt.size - wt.size;
        if (extra < bestExtra) {
          best = key;
          bestExtra = extra;
        }
      }
    }
    if (best === null) return [];
    bestTokens = tokens(best);
    matched.add(best);
  }
  const upgraded = new Set(bestTokens);
  upgraded.add("large");
  for (const key of componentKeys) {
    const kt = tokens(key);
    if (sameSet(kt, bestTokens) || sameSet(kt, upgraded)) matched.add(key);
  }
  return [...matched].sort();
}

function parseWants(lines) {
  const wants = new Map();
  for (const raw of lines) {
    const w = raw.trim();
    if (!w || w.startsWith("#")) continue;
    const m = w.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    const count = m ? parseInt(m[1], 10) : 1;
    const name = norm(m ? m[2] : w);
    if (!name) continue;
    wants.set(name, (wants.get(name) || 0) + count);
  }
  return wants;
}

// Contribution of a provides map to each want-group: sum over the group's
// matched component keys.
function contribution(provides, compGroups) {
  return compGroups.map((comps) => comps.reduce((s, c) => s + (provides[c] || 0), 0));
}

// Enumerate multisets of `n` picks from `options` (options pre-collapsed).
function* multisets(options, n, start = 0, acc = []) {
  if (n === 0) {
    yield acc;
    return;
  }
  for (let i = start; i < options.length; i++) {
    yield* multisets(options, n - 1, i, [...acc, options[i]]);
  }
}

// Expand a menu item into purchase variants: one per distinct modifier-group
// choice that affects coverage. Options that help no want-group are collapsed
// into the group's single cheapest option.
function buildVariants(menu, compGroups) {
  const groupsById = Object.fromEntries((menu.modifier_groups || []).map((g) => [g.id, g]));
  const variants = [];
  for (const item of menu.items) {
    const baseVec = contribution(itemProvides(item), compGroups);
    let combos = [{ deltaPence: 0, opts: [], vec: baseVec }];
    for (const gid of item.modifier_groups || []) {
      const g = groupsById[gid];
      if (!g) continue;
      const picks = Math.max(g.min || 0, Math.min(g.min || 0, g.max || 0)) || g.min || 0;
      if (!picks) continue;
      const helpful = [];
      let cheapestDud = null;
      for (const o of g.options) {
        const vec = contribution(optionProvides(o), compGroups);
        const pence = Math.round((o.price_delta || 0) * 100);
        if (vec.some((v) => v > 0)) helpful.push({ name: o.name, pence, vec });
        else if (!cheapestDud || pence < cheapestDud.pence)
          cheapestDud = { name: o.name, pence, vec };
      }
      const pool = cheapestDud ? [...helpful, cheapestDud] : helpful;
      if (!pool.length) continue;
      const next = [];
      for (const combo of combos) {
        for (const picksSet of multisets(pool, picks)) {
          const vec = [...combo.vec];
          let deltaPence = combo.deltaPence;
          const opts = [...combo.opts];
          for (const p of picksSet) {
            deltaPence += p.pence;
            p.vec.forEach((v, i) => (vec[i] += v));
            if (p.vec.some((v) => v > 0)) opts.push(p.name);
          }
          next.push({ deltaPence, opts, vec });
        }
      }
      combos = next;
    }
    const basePence = Math.round(item.price * 100);
    for (const c of combos) {
      if (c.vec.every((v) => v === 0)) continue;
      variants.push({
        item,
        pence: basePence + c.deltaPence,
        vec: c.vec,
        opts: c.opts,
      });
    }
  }
  // Keep only the cheapest variant per distinct contribution vector — an
  // exact reduction for the covering objective.
  const byVec = new Map();
  for (const v of variants) {
    const key = v.vec.join(",");
    const prev = byVec.get(key);
    if (!prev || v.pence < prev.pence) byVec.set(key, v);
  }
  return [...byVec.values()];
}

const STATE_LIMIT = 400000;

function solve(menu, rawWants) {
  const componentKeys = allComponentKeys(menu);
  const wants = parseWants(rawWants);
  const groups = [];
  const unmatched = [];
  for (const [want, count] of wants) {
    const comps = matchComponents(want, componentKeys);
    if (!comps.length) unmatched.push(want);
    else groups.push({ want, comps, count });
  }
  if (unmatched.length)
    return { status: "unmatched", unmatched, known: [...componentKeys].sort() };
  if (!groups.length) return { status: "empty" };

  const stateCount = groups.reduce((p, g) => p * (g.count + 1), 1);
  if (stateCount > STATE_LIMIT) return { status: "too_large" };

  const compGroups = groups.map((g) => g.comps);
  const variants = buildVariants(menu, compGroups);

  const memo = new Map();
  function best(state) {
    const key = state.join(",");
    if (memo.has(key)) return memo.get(key);
    if (state.every((v) => v === 0)) return { pence: 0, pick: null };
    memo.set(key, { pence: Infinity, pick: null }); // cycle guard
    let bestRes = { pence: Infinity, pick: null };
    for (const v of variants) {
      if (!v.vec.some((c, i) => c > 0 && state[i] > 0)) continue;
      const next = state.map((s, i) => Math.max(0, s - v.vec[i]));
      const sub = best(next);
      const pence = v.pence + sub.pence;
      if (pence < bestRes.pence) bestRes = { pence, pick: { variant: v, next } };
    }
    memo.set(key, bestRes);
    return bestRes;
  }

  const start = groups.map((g) => g.count);
  const res = best(start);
  if (!isFinite(res.pence)) return { status: "infeasible" };

  // Walk the solution, tallying identical picks.
  const lines = new Map();
  let state = start;
  let cur = res;
  while (cur.pick) {
    const v = cur.pick.variant;
    const key = v.item.name + "|" + v.opts.join("|");
    const line = lines.get(key) || { variant: v, qty: 0 };
    line.qty += 1;
    lines.set(key, line);
    state = cur.pick.next;
    cur = best(state);
  }

  return {
    status: "optimal",
    totalPence: res.pence,
    groups,
    basket: [...lines.values()].map((l) => ({
      name: l.variant.item.name,
      qty: l.qty,
      unitPence: l.variant.pence,
      opts: l.variant.opts,
      provides: itemProvides(l.variant.item),
      confidence: l.variant.item.contents_confidence || null,
    })),
  };
}

if (typeof module !== "undefined") {
  module.exports = { solve, parseWants, matchComponents, allComponentKeys, norm, tokens };
}
