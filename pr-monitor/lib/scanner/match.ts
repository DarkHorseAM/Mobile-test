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

export function extractBrand(
  text: string,
  brandExtractors: CompiledPattern[],
): string | null {
  for (const ext of brandExtractors) {
    const m = ext.regex.exec(text);
    if (m && m[1]) {
      const brand = m[1].trim().replace(/[.,;:]+$/, "");
      if (brand.length >= 3 && brand.length <= 80) return brand;
    }
  }
  return null;
}
