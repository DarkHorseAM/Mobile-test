const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 8000;

export type BylineFetchResult =
  | { ok: true; byline: string | null; source: "meta" | "jsonld" | "dom" | null; htmlExcerpt: string | null; httpStatus: number; bytes: number }
  | { ok: false; error: string };

export async function fetchByline(articleUrl: string): Promise<BylineFetchResult> {
  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(articleUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    html = await res.text();
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 200) };
  }

  // Cap haystack at 500KB to keep memory bounded but still cover
  // article body content on heavy publisher pages. Bylines on sites
  // like The Sun aren't in head metadata at all and only appear as
  // DOM elements past the 200KB analytics blob.
  const haystack = html.slice(0, 500_000);

  const httpStatus = 200; // fetch.ok was true above
  const bytes = html.length;

  const jsonLdName = extractJsonLdAuthor(haystack);
  if (jsonLdName) return { ok: true, byline: cleanByline(jsonLdName), source: "jsonld", htmlExcerpt: null, httpStatus, bytes };

  const metaName = extractMetaAuthor(haystack);
  if (metaName) return { ok: true, byline: cleanByline(metaName), source: "meta", htmlExcerpt: null, httpStatus, bytes };

  const domName = extractDomByline(haystack);
  if (domName) return { ok: true, byline: cleanByline(domName), source: "dom", htmlExcerpt: null, httpStatus, bytes };

  // Extraction failed - build a diagnostic excerpt focused on the
  // markup our parser inspects (meta tags + JSON-LD blocks + DOM
  // pattern signals) rather than raw HTML, which would be dominated
  // by inline analytics scripts.
  const htmlExcerpt = buildDiagnosticExcerpt(haystack);

  return { ok: true, byline: null, source: null, htmlExcerpt, httpStatus, bytes };
}

function extractDomByline(haystack: string): string | null {
  // <a rel="author">Name</a> - the most reliable DOM signal.
  const relMatches = haystack.matchAll(
    /<a\b[^>]*\brel\s*=\s*["']author["'][^>]*>([\s\S]*?)<\/a>/gi,
  );
  for (const m of relMatches) {
    const txt = stripTags(m[1]);
    if (looksLikeName(txt)) return txt;
  }

  // itemprop="author" - Schema.org microdata. Author element wraps
  // either text directly or a nested itemprop="name".
  const itempropMatch = haystack.match(
    /<[^>]+\bitemprop\s*=\s*["']author["'][^>]*>([\s\S]{0,800}?)<\/(?:span|div|a|p)>/i,
  );
  if (itempropMatch) {
    const nameMatch = itempropMatch[1].match(
      /<[^>]+\bitemprop\s*=\s*["']name["'][^>]*>([\s\S]{0,200}?)</i,
    );
    if (nameMatch) {
      const txt = stripTags(nameMatch[1]);
      if (looksLikeName(txt)) return txt;
    }
    const txt = stripTags(itempropMatch[1]);
    if (looksLikeName(txt)) return txt;
  }

  // Element whose class name contains "byline" — text content stripped
  // of HTML and "By " prefix.
  const bylineClassMatch = haystack.match(
    /<(?:span|div|p|a|h\d)[^>]*\bclass\s*=\s*["'][^"']*\bbyline[^"']*["'][^>]*>([\s\S]{0,500}?)<\/(?:span|div|p|a|h\d)>/i,
  );
  if (bylineClassMatch) {
    const txt = stripTags(bylineClassMatch[1]).replace(/^\s*by\s+/i, "");
    if (looksLikeName(txt)) return txt;
  }

  return null;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeName(s: string): boolean {
  if (!s) return false;
  if (s.length < 2 || s.length > 150) return false;
  // Reject obvious non-names like "Read more", "Comments", "@handle".
  if (/^[@#]/.test(s)) return false;
  if (/^(read more|comments?|share|reply|like)$/i.test(s)) return false;
  // Must contain at least one letter
  if (!/[a-z]/i.test(s)) return false;
  return true;
}

function buildDiagnosticExcerpt(haystack: string): string {
  const parts: string[] = [];

  const metas = haystack.match(/<meta\b[^>]*>/gi) ?? [];
  parts.push(`-- ${metas.length} <meta> tag${metas.length === 1 ? "" : "s"} --`);
  for (const m of metas.slice(0, 80)) parts.push(m);
  if (metas.length > 80) parts.push(`… ${metas.length - 80} more`);

  const ldBlocks = [
    ...haystack.matchAll(
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  parts.push("");
  parts.push(`-- ${ldBlocks.length} JSON-LD block${ldBlocks.length === 1 ? "" : "s"} --`);
  for (const [i, b] of ldBlocks.entries()) {
    const content = b[1].replace(/\s+/g, " ").trim().slice(0, 800);
    parts.push(`[${i + 1}] ${content}${b[1].length > 800 ? " …" : ""}`);
  }

  // DOM pattern signals — confirms whether common byline DOM
  // structures exist on the page at all. Helps diagnose whether to
  // add new extraction patterns or accept that this publisher just
  // doesn't publish the byline in scrapable form.
  const relAuthorCount = (haystack.match(/\brel\s*=\s*["']author["']/gi) ?? []).length;
  const bylineClassCount = (haystack.match(/class\s*=\s*["'][^"']*\bbyline\b[^"']*["']/gi) ?? []).length;
  const authorClassCount = (haystack.match(/class\s*=\s*["'][^"']*\bauthor\b[^"']*["']/gi) ?? []).length;
  const itempropAuthorCount = (haystack.match(/\bitemprop\s*=\s*["']author["']/gi) ?? []).length;
  const authorMentions = (haystack.match(/\bauthor\b/gi) ?? []).length;
  parts.push("");
  parts.push("-- DOM pattern signals --");
  parts.push(`rel="author":      ${relAuthorCount}`);
  parts.push(`itemprop="author": ${itempropAuthorCount}`);
  parts.push(`class~byline:      ${bylineClassCount}`);
  parts.push(`class~author:      ${authorClassCount}`);
  parts.push(`"author" anywhere: ${authorMentions}`);

  // Sample the first byline-class match if present, so we can see the
  // exact markup if our extractor isn't catching it.
  if (bylineClassCount > 0) {
    const sample = haystack.match(
      /<[^>]+\bclass\s*=\s*["'][^"']*\bbyline[^"']*["'][^>]*>[\s\S]{0,300}/i,
    );
    if (sample) {
      parts.push("");
      parts.push("First class~byline match:");
      parts.push(sample[0].slice(0, 400));
    }
  }

  return parts.join("\n").slice(0, 12000);
}

function extractMetaAuthor(html: string): string | null {
  const metas = html.matchAll(/<meta\b[^>]*>/gi);
  for (const m of metas) {
    const tag = m[0];
    const name = (tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1] || "").toLowerCase();
    if (name !== "author" && name !== "article:author" && name !== "parsely-author") continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!content) continue;
    // article:author is sometimes a URL, not a name. Skip URLs.
    if (/^https?:\/\//i.test(content)) continue;
    return content;
  }
  return null;
}

function extractJsonLdAuthor(html: string): string | null {
  const blocks = html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const b of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(b[1].trim());
    } catch {
      continue;
    }
    const name = walkForAuthor(data);
    if (name) return name;
  }
  return null;
}

function walkForAuthor(node: unknown, depth = 0): string | null {
  if (depth > 6 || node == null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const n = walkForAuthor(child, depth + 1);
      if (n) return n;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;

  // Direct author property — handle string, object, or array
  if ("author" in obj) {
    const a = obj.author;
    const name = authorToName(a);
    if (name) return name;
  }

  // @graph wrapper — recurse
  if ("@graph" in obj) {
    const n = walkForAuthor(obj["@graph"], depth + 1);
    if (n) return n;
  }

  return null;
}

function authorToName(a: unknown): string | null {
  if (typeof a === "string") return a;
  if (Array.isArray(a)) {
    const names = a.map(authorToName).filter((n): n is string => !!n);
    return names.length ? names.join(", ") : null;
  }
  if (a && typeof a === "object") {
    const obj = a as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name;
  }
  return null;
}

function cleanByline(raw: string): string | null {
  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/^\s*by\s+/i, "")
    .trim();
  if (!cleaned) return null;
  if (/^https?:\/\//i.test(cleaned)) return null;
  return cleaned.slice(0, 200);
}
