import { and, asc, count, eq, gte, inArray } from "drizzle-orm";
import { connection } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { coachConversation, coachMessage } from "@/db/schema";
import { AiError, aiConfigured, chatWithTools, type GeminiContent } from "@/lib/ai/gemini";
import { getCurrentUser } from "@/lib/session";
import { coachSystem } from "@/server/coach/prompt";
import { COACH_TOOLS, coachContext, runCoachTool } from "@/server/coach/tools";

export const maxDuration = 120;

const body = z.object({
  conversationId: z.string().min(1).max(64).nullish(),
  message: z.string().trim().min(1).max(4000),
});

const HISTORY = 20;
const DAILY_LIMIT = 150;

/** One coach turn: save the question, let Gemini look up the user's data, save and return the answer. */
export async function POST(req: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!aiConfigured()) return Response.json({ error: "AI isn't set up: add GEMINI_API_KEY in your environment." }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Write a message first." }, { status: 400 });
  const { message } = parsed.data;

  // Quota: messages sent today across all conversations.
  const mine = db.select({ id: coachConversation.id }).from(coachConversation).where(eq(coachConversation.userId, user.id));
  const [{ n }] = await db
    .select({ n: count() })
    .from(coachMessage)
    .where(and(inArray(coachMessage.conversationId, mine), eq(coachMessage.role, "user"), gte(coachMessage.createdAt, new Date(Date.now() - 86_400_000))));
  if (n >= DAILY_LIMIT) return Response.json({ error: `You've sent ${DAILY_LIMIT} messages in the last 24 hours. Please try again later.` }, { status: 429 });

  let conversationId = parsed.data.conversationId ?? null;
  const isNew = !conversationId;
  if (conversationId) {
    const [c] = await db
      .select({ id: coachConversation.id })
      .from(coachConversation)
      .where(and(eq(coachConversation.id, conversationId), eq(coachConversation.userId, user.id)))
      .limit(1);
    if (!c) return Response.json({ error: "Conversation not found." }, { status: 404 });
  } else {
    const title = message.replace(/\s+/g, " ").slice(0, 80);
    const [c] = await db.insert(coachConversation).values({ userId: user.id, title }).returning({ id: coachConversation.id });
    conversationId = c.id;
  }

  const past = await db
    .select({ role: coachMessage.role, content: coachMessage.content })
    .from(coachMessage)
    .where(eq(coachMessage.conversationId, conversationId))
    .orderBy(asc(coachMessage.createdAt));
  const [saved] = await db.insert(coachMessage).values({ conversationId, role: "user", content: message }).returning({ id: coachMessage.id });

  const history: GeminiContent[] = [...past.slice(-HISTORY), { role: "user", content: message }].map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  // Gemini wants the conversation to start with the user.
  while (history.length && history[0].role !== "user") history.shift();

  try {
    const ctx = await coachContext(user);
    const answer = await chatWithTools({
      system: coachSystem({ ...ctx, baseCurrency: user.baseCurrency }),
      history,
      tools: COACH_TOOLS,
      runTool: (name, args) => runCoachTool(user, name, args),
      budgetMs: 105_000,
    });
    const toolsUsed = [...new Set(answer.toolsUsed)];
    const [reply] = await db
      .insert(coachMessage)
      .values({ conversationId, role: "assistant", content: answer.text, toolsUsed, model: answer.model })
      .returning({ id: coachMessage.id });
    await db.update(coachConversation).set({ updatedAt: new Date() }).where(eq(coachConversation.id, conversationId));
    return Response.json(
      { conversationId, message: { id: reply.id, role: "assistant", content: answer.text, toolsUsed } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[coach] failed", e);
    // Undo the question so "Try again" doesn't save it twice.
    await db.delete(coachMessage).where(eq(coachMessage.id, saved.id));
    if (isNew) await db.delete(coachConversation).where(eq(coachConversation.id, conversationId));
    const error = e instanceof AiError ? e.message : "Something went wrong while answering. Please try again.";
    return Response.json({ conversationId: isNew ? null : conversationId, error }, { status: 502 });
  }
}
