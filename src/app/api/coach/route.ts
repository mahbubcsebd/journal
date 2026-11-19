import { and, asc, count, eq, gte, inArray } from "drizzle-orm";
import { connection } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { coachConversation, coachMessage } from "@/db/schema";
import { AiError, aiConfigured, chatWithTools, type GeminiContent, type GeminiPart } from "@/lib/ai/gemini";
import { getCurrentUser } from "@/lib/session";
import { coachSystem } from "@/server/coach/prompt";
import { COACH_TOOLS, coachContext, listMemories, runCoachTool } from "@/server/coach/tools";

export const maxDuration = 120;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const body = z.object({
  conversationId: z.string().min(1).max(64).nullish(),
  message: z.string().trim().max(4000).default(""),
  // Chart screenshots, resized in the browser. ~1.5 MB of base64 each at most.
  images: z
    .array(z.object({ mimeType: z.enum(IMAGE_TYPES), data: z.string().min(16).max(2_000_000).regex(/^[A-Za-z0-9+/=]+$/) }))
    .max(3)
    .default([]),
});

const HISTORY = 20;
const DAILY_LIMIT = 150;

export type CoachStreamEvent =
  | { type: "meta"; conversationId: string }
  | { type: "tool"; name: string }
  | { type: "text"; text: string }
  | { type: "done"; message: { id: string; role: "assistant"; content: string; toolsUsed: string[] } }
  | { type: "error"; error: string; conversationId: string | null };

/**
 * One coach turn, streamed as NDJSON: save the question, let Gemini look up the
 * user's data (tool events), stream the answer text, then save it.
 */
export async function POST(req: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!aiConfigured()) return Response.json({ error: "AI isn't set up: add GEMINI_API_KEY in your environment." }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That message or picture can't be sent. Pictures must be JPG, PNG or WebP." }, { status: 400 });
  const { images } = parsed.data;
  const message = parsed.data.message || (images.length ? "Please analyse this chart." : "");
  if (!message) return Response.json({ error: "Write a message first." }, { status: 400 });

  // Quota: messages sent in the last 24 hours across all conversations.
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
    const title = (images.length && !parsed.data.message ? "📈 Chart review" : message).replace(/\s+/g, " ").slice(0, 80);
    const [c] = await db.insert(coachConversation).values({ userId: user.id, title }).returning({ id: coachConversation.id });
    conversationId = c.id;
  }
  const cid = conversationId;

  const past = await db
    .select({ role: coachMessage.role, content: coachMessage.content, images: coachMessage.images })
    .from(coachMessage)
    .where(eq(coachMessage.conversationId, cid))
    .orderBy(asc(coachMessage.createdAt));
  const [saved] = await db
    .insert(coachMessage)
    .values({ conversationId: cid, role: "user", content: message, images: images.length })
    .returning({ id: coachMessage.id });

  const history: GeminiContent[] = past.slice(-HISTORY).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    // Pictures aren't kept; earlier turns only say one was there.
    parts: [{ text: m.images ? `[${m.images} chart image(s) attached earlier]\n${m.content}` : m.content }],
  }));
  history.push({ role: "user", parts: [...images.map((i): GeminiPart => ({ inlineData: { mimeType: i.mimeType, data: i.data } })), { text: message }] });
  // Gemini wants the conversation to start with the user.
  while (history.length && history[0].role !== "user") history.shift();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The reader may leave (Stop button, closed tab): keep working and save the answer anyway.
      let open = true;
      const send = (e: CoachStreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          open = false;
        }
      };
      send({ type: "meta", conversationId: cid });
      try {
        const [ctx, memories] = await Promise.all([coachContext(user), listMemories(user.id).catch(() => [])]);
        const answer = await chatWithTools({
          system: coachSystem({ ...ctx, baseCurrency: user.baseCurrency, language: user.settings.coachLanguage ?? "auto", memories }),
          history,
          tools: COACH_TOOLS,
          runTool: (name, args) => runCoachTool(user, name, args),
          budgetMs: 110_000,
          onEvent: (e) => send(e.type === "tool" ? { type: "tool", name: e.name } : { type: "text", text: e.text }),
        });
        const toolsUsed = [...new Set(answer.toolsUsed)];
        const [reply] = await db
          .insert(coachMessage)
          .values({ conversationId: cid, role: "assistant", content: answer.text, toolsUsed, model: answer.model })
          .returning({ id: coachMessage.id });
        await db.update(coachConversation).set({ updatedAt: new Date() }).where(eq(coachConversation.id, cid));
        send({ type: "done", message: { id: reply.id, role: "assistant", content: answer.text, toolsUsed } });
      } catch (e) {
        console.error("[coach] failed", e);
        // Undo the question so "Try again" doesn't save it twice.
        await db.delete(coachMessage).where(eq(coachMessage.id, saved.id)).catch(() => {});
        if (isNew) await db.delete(coachConversation).where(eq(coachConversation.id, cid)).catch(() => {});
        const error = e instanceof AiError ? e.message : "Something went wrong while answering. Please try again.";
        send({ type: "error", error, conversationId: isNew ? null : cid });
      } finally {
        if (open) controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
