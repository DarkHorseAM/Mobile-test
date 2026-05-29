const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 8000;

export type BylineFetchResult =
  | { ok: true; byline: string | null; source: "meta" | "jsonld" | null }
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

  // Search the head + first 200KB of body — bylines are always in
  // <head> meta tags or in JSON-LD that follows shortly after. Avoids
  // parsing huge article bodies.
  const haystack = html.slice(0, 200_000);

  const jsonLdName = extractJsonLdAuthor(haystack);
  if (jsonLdName) return { ok: true, byline: cleanByline(jsonLdName), source: "jsonld" };

  const metaName = extractMetaAuthor(haystack);
  if (metaName) return { ok: true, byline: cleanByline(metaName), source: "meta" };

  return { ok: true, byline: null, source: null };
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
