import { connection } from "next/server";
import { z } from "zod";
import { AiError, aiConfigured } from "@/lib/ai/gemini";
import { getCurrentUser } from "@/lib/session";
import { generateCoachReport } from "@/server/services/coach-reports";

export const maxDuration = 120;

/** "Review my day / week now": builds (or rebuilds) the report and returns its chat. */
export async function POST(req: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!aiConfigured()) return Response.json({ error: "AI isn't set up: add GEMINI_API_KEY." }, { status: 503 });
  const parsed = z.object({ kind: z.enum(["daily", "weekly"]), today: z.boolean().default(false) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { kind } = parsed.data;
  try {
    // "today": review the day so far rather than yesterday.
    const r = await generateCoachReport(user, kind, { force: true, includeToday: parsed.data.today && kind === "daily" });
    if (!r) return Response.json({ error: kind === "daily" ? "No closed trades in that day yet." : "No closed trades last week." }, { status: 404 });
    return Response.json({ conversationId: r.conversationId });
  } catch (e) {
    console.error("[coach] report failed", e);
    return Response.json({ error: e instanceof AiError ? e.message : "Couldn't build the review. Please try again." }, { status: 502 });
  }
}
