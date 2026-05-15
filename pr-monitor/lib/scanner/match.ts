export type CompiledPattern = {
  id: number;
  slug: string;
  label: string;
  regex: RegExp;
};

export function compilePatterns(
  rows: { id: number; slug: string; label: string; regex: string }[],
): CompiledPattern[] {
  const out: CompiledPattern[] = [];
  for (const r of rows) {
    try {
      out.push({ id: r.id, slug: r.slug, label: r.label, regex: new RegExp(r.regex, "i") });
    } catch (e) {
      console.warn(`Skipping invalid regex for pattern "${r.slug}":`, (e as Error).message);
    }
  }
  return out;
}

export function snippetAround(text: string, idx: number, len: number, pad = 30): string {
  const start = Math.max(0, idx - pad);
  const end = Math.min(text.length, idx + len + pad);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end).replace(/\s+/g, " ").trim() + suffix;
}

export function findIndicatorMatches(
  text: string,
  indicators: CompiledPattern[],
): { patternId: number; snippet: string }[] {
  const matches: { patternId: number; snippet: string }[] = [];
  const seen = new Set<number>();
  for (const ind of indicators) {
    const m = ind.regex.exec(text);
    if (m && !seen.has(ind.id)) {
      seen.add(ind.id);
      matches.push({ patternId: ind.id, snippet: snippetAround(text, m.index, m[0].length) });
    }
  }
  return matches;
}

const BRAND_REJECT_VERBS = new Set([
  "is", "are", "was", "were",
  "suggest", "suggests",
  "reveal", "reveals",
  "find", "finds",
  "show", "shows",
  "say", "says",
]);

const BRAND_REJECT_PREFIXES = new Set(["the", "a", "last"]);

export function cleanBrand(raw: string): string | null {
  let s = raw.trim();
  s = s.replace(/[’']s$/i, "");
  s = s.replace(/[.,;:'‘’“”]+$/g, "").trim();
  if (s.length < 3 || s.length > 80) return null;
  if (!/^[A-Z]/.test(s)) return null;
  const words = s.split(/\s+/);
  if (words.length > 4) return null;
  if (BRAND_REJECT_PREFIXES.has(words[0].toLowerCase())) return null;
  for (const w of words) {
    if (BRAND_REJECT_VERBS.has(w.toLowerCase())) return null;
  }
  return s;
}

export function extractBrand(
  text: string,
  brandExtractors: CompiledPattern[],
): string | null {
  for (const ext of brandExtractors) {
    const m = ext.regex.exec(text);
    if (m && m[1]) {
      const cleaned = cleanBrand(m[1]);
      if (cleaned) return cleaned;
    }
  }
  return null;
}
