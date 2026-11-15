import { connection } from "next/server";
import { z } from "zod";
import { aiConfigured, aiModel, AiError, generateJsonWithMeta } from "@/lib/ai/gemini";
import { getCurrentUser } from "@/lib/session";

export const maxDuration = 60;

/**
 * Signed-in check that the Gemini key works: one tiny request, then which API
 * and model answered, or Google's own error. Never returns the key.
 */
export async function GET() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const keyHint = (process.env.GEMINI_API_KEY ?? "").trim();
  const info = {
    configured: aiConfigured(),
    keyStartsWith: keyHint ? keyHint.slice(0, 4) + "…" : null,
    configuredModel: aiModel(),
  };
  const started = Date.now();
  try {
    const r = await generateJsonWithMeta({
      system: "You are a health check.",
      prompt: 'Reply with {"reply":"ok"}.',
      responseSchema: { type: "OBJECT", properties: { reply: { type: "STRING" } }, required: ["reply"] },
      validate: z.object({ reply: z.string() }),
      temperature: 0,
    });
    return Response.json(
      { ok: true, ...info, answeredBy: r.endpoint, model: r.model, ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const error = e instanceof AiError ? `${e.code}: ${e.message}` : String(e);
    return Response.json({ ok: false, ...info, error, ms: Date.now() - started }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
