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
const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-2.5-flash"];

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

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  validate: z.ZodType<T>;
  temperature?: number;
}): Promise<T> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new AiError("AI insights aren't set up yet. Add GEMINI_API_KEY to the server environment.", "NOT_CONFIGURED");
  const base = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      responseMimeType: "application/json",
      responseSchema: opts.responseSchema,
    },
  });

  // Try the configured model, then current ones if Google says it doesn't exist.
  const models = [...new Set([aiModel(), ...FALLBACK_MODELS])];
  let res: Response | null = null;
  for (const model of models) {
    try {
      res = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(55_000),
      });
    } catch (e) {
      console.error("[ai] request failed", e);
      throw new AiError("Couldn't reach Gemini (no response in time). Please try again.", "UNAVAILABLE");
    }
    if (res.status !== 404) break;
    console.warn(`[ai] model ${model} not found, trying the next one`);
  }
  if (!res) throw new AiError("Couldn't reach Gemini. Please try again.", "UNAVAILABLE");

  if (!res.ok) {
    const msg = await googleMessage(res);
    console.error(`[ai] Gemini ${res.status}: ${msg}`);
    if (res.status === 429) throw new AiError(`Gemini's free-tier limit was reached. Wait a minute and try again. (${msg})`, "RATE_LIMITED");
    if (/api[ _-]?key|API_KEY|permission|unauthori[sz]ed|credential/i.test(msg) || res.status === 401 || res.status === 403)
      throw new AiError(`Google rejected the Gemini API key: ${msg}`, "BAD_KEY");
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
  return out.data;
}
