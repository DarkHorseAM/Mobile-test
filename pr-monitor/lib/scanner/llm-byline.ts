// Gemini-assisted byline extraction. Runs only as a last-resort
// fallback when regex/DOM heuristics come up empty.
//
// Free-tier quotas are per-model and easy to exhaust, so we cycle
// through a priority-ordered list of models. On a model returning a
// rate-limit or transient error we move on to the next; on a clean
// "NONE" verdict we stop (the model judged there's no byline — using
// a more capable model could invent one). On a name we return it.

const DEFAULT_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
].join(",");
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

type ModelOutcome =
  | { kind: "name"; byline: string; tokensUsed: number | null }
  | { kind: "none"; tokensUsed: number | null }
  | { kind: "retry"; reason: string };

export type LlmExtractionResult = {
  byline: string | null;
  modelUsed: string | null;
  tokensUsed: number | null;
  attempts: { model: string; outcome: string }[];
};

function getModels(): string[] {
  const raw = process.env.GEMINI_MODELS || DEFAULT_MODELS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function extractBylineWithLlm(
  diagnosticExcerpt: string,
): Promise<LlmExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { byline: null, modelUsed: null, tokensUsed: null, attempts: [] };

  const models = getModels();
  const attempts: { model: string; outcome: string }[] = [];

  for (const model of models) {
    const outcome = await tryModel(model, apiKey, diagnosticExcerpt);
    if (outcome.kind === "name") {
      attempts.push({ model, outcome: "name" });
      return { byline: outcome.byline, modelUsed: model, tokensUsed: outcome.tokensUsed, attempts };
    }
    if (outcome.kind === "none") {
      attempts.push({ model, outcome: "NONE" });
      return { byline: null, modelUsed: model, tokensUsed: outcome.tokensUsed, attempts };
    }
    attempts.push({ model, outcome: outcome.reason });
  }

  return { byline: null, modelUsed: null, tokensUsed: null, attempts };
}

async function tryModel(
  model: string,
  apiKey: string,
  prompt: string,
): Promise<ModelOutcome> {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: prompt.slice(0, 12000) }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 60,
      responseMimeType: "text/plain",
    },
  };

  const url = `${ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    return { kind: "retry", reason: `network: ${(e as Error).message.slice(0, 80)}` };
  }
  clearTimeout(timer);

  // 429 (quota), 5xx (server) and 400 (often "model not found" on the
  // free tier when a model isn't actually available to your key) are
  // all "try the next model" signals.
  if (!res.ok) {
    return { kind: "retry", reason: `HTTP ${res.status}` };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    return { kind: "retry", reason: `bad json: ${(e as Error).message.slice(0, 60)}` };
  }

  const text = extractText(json);
  const tokensUsed = extractTokenCount(json);
  if (!text) return { kind: "retry", reason: "empty response" };

  const firstLine = text.trim().split(/\r?\n/, 1)[0].trim();
  if (!firstLine) return { kind: "retry", reason: "blank text" };
  if (/^none$/i.test(firstLine)) return { kind: "none", tokensUsed };
  if (firstLine.length > 200) return { kind: "retry", reason: "name too long" };
  if (!/[a-z]/i.test(firstLine)) return { kind: "retry", reason: "no letters" };
  return { kind: "name", byline: firstLine, tokensUsed };
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
