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

export const aiModel = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const aiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  validate: z.ZodType<T>;
  temperature?: number;
}): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError("AI insights aren't set up yet. Add GEMINI_API_KEY to the server environment.", "NOT_CONFIGURED");
  const base = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, "");

  let res: Response;
  try {
    res = await fetch(`${base}/v1beta/models/${aiModel()}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.4,
          responseMimeType: "application/json",
          responseSchema: opts.responseSchema,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AiError("Couldn't reach Gemini. Please try again.", "UNAVAILABLE");
  }

  if (res.status === 429) throw new AiError("Gemini's free-tier limit was reached. Wait a minute and try again.", "RATE_LIMITED");
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => "");
    if (/api key|API_KEY|permission/i.test(body)) throw new AiError("The Gemini API key was rejected. Check GEMINI_API_KEY.", "BAD_KEY");
    throw new AiError("Gemini rejected the request.", "BAD_RESPONSE");
  }
  if (!res.ok) throw new AiError(`Gemini is unavailable right now (${res.status}).`, "UNAVAILABLE");

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (json.promptFeedback?.blockReason) throw new AiError("Gemini declined to answer this request.", "BAD_RESPONSE");
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new AiError("Gemini returned an unreadable answer. Try again.", "BAD_RESPONSE");
  }
  const out = opts.validate.safeParse(parsed);
  if (!out.success) throw new AiError("Gemini's answer was incomplete. Try again.", "BAD_RESPONSE");
  return out.data;
}
