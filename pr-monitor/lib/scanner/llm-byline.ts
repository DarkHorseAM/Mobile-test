// Gemini-assisted byline extraction. Runs only as a last-resort
// fallback when regex/DOM heuristics come up empty. Reads
// GEMINI_API_KEY from env; returns null if not configured so the
// regex-only path keeps working unchanged.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 12000;

const SYSTEM_PROMPT = `You are extracting the author/byline of a news article from its HTML metadata.

Below are the <meta> tags, JSON-LD blocks, and byline-related DOM samples that were extracted from the article's HTML. Identify the article's human author(s) — the journalist or journalists who wrote the piece.

Rules:
- Respond with ONLY the author name (or "NONE"), with no other text, no punctuation around the name, no quotes.
- If there are multiple authors, join with ", " — e.g. "Sarah Smith, John Doe".
- If you cannot find a clear human name, respond with exactly: NONE
- Organisation names ("Daily Mail Reporter", "Editorial Team", "Staff Writer") count as NONE. We only want real people's names.
- Do not invent. Do not guess. If the byline is not present in the markup, respond NONE.`;

export async function extractBylineWithLlm(
  diagnosticExcerpt: string,
): Promise<{ byline: string | null; tokensUsed: number | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { byline: null, tokensUsed: null };

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: diagnosticExcerpt.slice(0, 12000) }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 60,
      responseMimeType: "text/plain",
    },
  };

  const url = `${ENDPOINT}/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let json: unknown;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return { byline: null, tokensUsed: null };
    json = await res.json();
  } catch {
    return { byline: null, tokensUsed: null };
  } finally {
    clearTimeout(timer);
  }

  const text = extractText(json);
  if (!text) return { byline: null, tokensUsed: null };
  const cleaned = text.trim();
  if (!cleaned || /^none$/i.test(cleaned)) return { byline: null, tokensUsed: null };

  // Reject anything that doesn't look like a name. Model occasionally
  // appends explanatory text despite the prompt.
  const firstLine = cleaned.split(/\r?\n/, 1)[0].trim();
  if (firstLine.length > 200) return { byline: null, tokensUsed: null };
  if (!/[a-z]/i.test(firstLine)) return { byline: null, tokensUsed: null };

  return { byline: firstLine, tokensUsed: extractTokenCount(json) };
}

function extractText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const candidates = obj.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0] as Record<string, unknown> | undefined;
  const content = first?.content as Record<string, unknown> | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts)) return null;
  const part = parts[0] as Record<string, unknown> | undefined;
  return typeof part?.text === "string" ? part.text : null;
}

function extractTokenCount(json: unknown): number | null {
  if (!json || typeof json !== "object") return null;
  const usage = (json as Record<string, unknown>).usageMetadata;
  if (!usage || typeof usage !== "object") return null;
  const total = (usage as Record<string, unknown>).totalTokenCount;
  return typeof total === "number" ? total : null;
}
