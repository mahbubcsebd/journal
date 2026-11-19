import "server-only";
import type { z } from "zod";

/**
 * Minimal Gemini REST client (no SDK). The key is sent in the
 * `x-goog-api-key` header; `GEMINI_BASE_URL` exists so tests can point at a
 * local mock server.
 */
export class AiError extends Error {
  constructor(
    message: string,
    public code: "NOT_CONFIGURED" | "RATE_LIMITED" | "BAD_KEY" | "BAD_RESPONSE" | "UNAVAILABLE",
  ) {
    super(message);
  }
}

// "gemini-flash-latest" always points at Google's current Flash model, so the
// app keeps working when a pinned version is retired. GEMINI_MODEL overrides it.
const DEFAULT_MODEL = "gemini-flash-latest";
// Busy, retired or slow models fall through to the next; the lite model is
// the fast, high-capacity last resort.
const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"];
/** Per-model wait: a few attempts must fit in a 60-second function. */
const ATTEMPT_TIMEOUT_MS = 18_000;
/** Statuses where another model may succeed: retired, quota/rate, overloaded. */
const TRY_NEXT = new Set([404, 429, 500, 502, 503, 504]);

/** Models that were busy or silent recently are skipped for a few minutes (per server instance). */
const COOLDOWN_MS = 5 * 60_000;
const coolingUntil = new Map<string, number>();
const cooling = (model: string) => (coolingUntil.get(model) ?? 0) > Date.now();
const coolDown = (model: string) => coolingUntil.set(model, Date.now() + COOLDOWN_MS);
/** Tests only: forget which models were cooling down. */
export const resetModelCooldowns = () => coolingUntil.clear();

export const aiModel = () => process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
export const aiConfigured = () => Boolean(process.env.GEMINI_API_KEY?.trim());

/** Google's own error text, e.g. "API key expired. Please renew the API key." */
async function googleMessage(res: Response) {
  const body = await res.text().catch(() => "");
  try {
    const m = (JSON.parse(body) as { error?: { message?: string } }).error?.message;
    if (m) return m.slice(0, 300);
  } catch {}
  return body.slice(0, 300);
}

type Endpoint = { name: "gemini-api" | "vertex-ai"; url: (model: string) => string };

/**
 * Google serves Gemini from two APIs. AI Studio keys ("AIza…") work on the
 * Gemini API; Vertex AI express-mode keys (often "AQ.…") work on Vertex AI.
 * Try the Gemini API first and fall back to Vertex AI if the key is refused.
 */
function endpoints(): Endpoint[] {
  const custom = process.env.GEMINI_BASE_URL?.replace(/\/$/, "");
  if (custom) return [{ name: "gemini-api", url: (m) => `${custom}/v1beta/models/${encodeURIComponent(m)}:generateContent` }];
  return [
    { name: "gemini-api", url: (m) => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent` },
    { name: "vertex-ai", url: (m) => `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(m)}:generateContent` },
  ];
}

export type AiMeta = { endpoint: Endpoint["name"]; model: string };

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  validate: z.ZodType<T>;
  temperature?: number;
}): Promise<T> {
  return (await generateJsonWithMeta(opts)).data;
}

export async function generateJsonWithMeta<T>(opts: {
  system: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  validate: z.ZodType<T>;
  temperature?: number;
}): Promise<{ data: T } & AiMeta> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new AiError("AI insights aren't set up yet. Add GEMINI_API_KEY to the server environment.", "NOT_CONFIGURED");
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      responseMimeType: "application/json",
      responseSchema: opts.responseSchema,
    },
  });

  // Configured model first, then current ones if Google says it doesn't exist.
  const models = [...new Set([aiModel(), ...FALLBACK_MODELS])];
  const apis = endpoints();
  let res: Response | null = null;
  let used: AiMeta | null = null;
  let timedOut = 0;
  const started = Date.now();
  apis: for (const [ai, api] of apis.entries()) {
    for (const [mi, model] of models.entries()) {
      const last = mi === models.length - 1;
      if (cooling(model) && !last) continue;
      // Stay inside the function's time limit.
      if (Date.now() - started > 50_000) break apis;
      try {
        res = await fetch(api.url(model), {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body,
          signal: AbortSignal.timeout(last ? 25_000 : ATTEMPT_TIMEOUT_MS),
        });
      } catch (e) {
        timedOut++;
        coolDown(model);
        console.warn(`[ai] ${api.name}: ${model} gave no answer in time`, e instanceof Error ? e.name : e);
        res = null;
        continue;
      }
      used = { endpoint: api.name, model };
      if (TRY_NEXT.has(res.status) && res.status !== 404) coolDown(model);
      if (TRY_NEXT.has(res.status) && !last) {
        console.warn(`[ai] ${api.name}: ${model} → ${res.status} ${await googleMessage(res)}; trying the next model`);
        continue;
      }
      // Key refused by this API: it may belong to the other one.
      if ((res.status === 401 || res.status === 403) && ai < apis.length - 1) {
        console.warn(`[ai] ${api.name} refused the key (${res.status}): ${await googleMessage(res)}; trying ${apis[ai + 1].name}`);
        continue apis;
      }
      break apis;
    }
  }
  if (!res || !used)
    throw new AiError(
      timedOut ? "Gemini is very busy right now and didn't answer in time. Please try again in a minute." : "Couldn't reach Gemini. Please try again.",
      "UNAVAILABLE",
    );

  if (!res.ok) {
    const msg = await googleMessage(res);
    console.error(`[ai] ${used.endpoint} ${used.model} ${res.status}: ${msg}`);
    if (res.status === 429) throw new AiError(`Gemini's free-tier limit was reached. Wait a minute and try again. (${msg})`, "RATE_LIMITED");
    if (/api[ _-]?key|API_KEY|permission|unauthori[sz]ed|credential/i.test(msg) || res.status === 401 || res.status === 403)
      throw new AiError(`Google rejected the Gemini API key: ${msg}`, "BAD_KEY");
    if (res.status === 404) throw new AiError(`No Gemini model was found for this key (tried ${models.join(", ")}): ${msg}`, "UNAVAILABLE");
    if (res.status === 400) throw new AiError(`Gemini rejected the request: ${msg}`, "BAD_RESPONSE");
    throw new AiError(`Gemini is unavailable right now (${res.status}): ${msg}`, "UNAVAILABLE");
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (json.promptFeedback?.blockReason) throw new AiError("Gemini declined to answer this request.", "BAD_RESPONSE");
  const text =
    json.candidates?.[0]?.content?.parts
      ?.filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("") ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    console.error("[ai] unreadable answer", json.candidates?.[0]?.finishReason, text.slice(0, 300));
    throw new AiError("Gemini returned an unreadable answer. Try again.", "BAD_RESPONSE");
  }
  const out = opts.validate.safeParse(parsed);
  if (!out.success) {
    console.error("[ai] answer failed validation", out.error.issues.slice(0, 3));
    throw new AiError("Gemini's answer was incomplete. Try again.", "BAD_RESPONSE");
  }
  return { data: out.data, ...used };
}
