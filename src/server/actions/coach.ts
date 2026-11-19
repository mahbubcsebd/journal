"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { coachConversation, coachMemory, coachMessage, goal, note, user as userTable, type UserSettings } from "@/db/schema";
import { coachAction } from "@/lib/coach-blocks";
import { markdownToDoc } from "@/lib/doc";
import { GOAL_METRICS, PERIOD_LABEL } from "@/lib/goals";
import { listMemories, MAX_MEMORIES } from "@/server/coach/tools";
import { aiConfigured, callGemini } from "@/lib/ai/gemini";
import { getCurrentUser } from "@/lib/session";
import { runPreTrade } from "@/server/coach/pretrade";

export async function deleteConversation(id: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Please sign in again." };
  const cid = z.string().min(1).max(64).parse(id);
  await db.delete(coachConversation).where(and(eq(coachConversation.id, cid), eq(coachConversation.userId, user.id)));
  return { ok: true as const };
}

export async function renameConversation(id: string, title: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Please sign in again." };
  const t = z.string().trim().min(1).max(80).parse(title);
  await db
    .update(coachConversation)
    .set({ title: t })
    .where(and(eq(coachConversation.id, z.string().min(1).max(64).parse(id)), eq(coachConversation.userId, user.id)));
  return { ok: true as const };
}

const preTradeInput = z.object({
  accountId: z.string().min(1).max(64),
  symbol: z.string().trim().min(2).max(20),
  side: z.enum(["LONG", "SHORT"]),
  entry: z.coerce.number().positive(),
  sl: z.coerce.number().positive().nullish(),
  tp: z.coerce.number().positive().nullish(),
  lots: z.coerce.number().positive().max(1000),
  lang: z.enum(["en", "bn"]),
});

export type PreTradeResult =
  | {
      ok: true;
      verdict: "ok" | "caution" | "stop";
      checks: { id: string; level: "ok" | "caution" | "stop"; title: string; detail: string }[];
      ai: string | null;
      account: { name: string; currency: string; balance: number | null };
    }
  | { ok: false; error: string };

/** Rule checks for a planned trade, plus a short AI opinion when Gemini is available. */
export async function preTradeCheckAction(input: z.input<typeof preTradeInput>): Promise<PreTradeResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const parsed = preTradeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Fill in symbol, entry price and lot size." };
  const { accountId, lang, ...planned } = parsed.data;
  let result;
  try {
    result = await runPreTrade(user, accountId, planned, lang);
  } catch (e) {
    console.error("[pretrade] failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't run the check." };
  }
  let ai: string | null = null;
  if (aiConfigured()) {
    try {
      const { reply } = await callGemini(
        {
          systemInstruction: {
            parts: [
              {
                text: `You are a strict but supportive trading risk coach. Given a planned trade and rule-check results computed from the trader's own history, give a verdict in 3-5 short markdown bullet points: the main reason to take or skip it, what to change (size, stop, timing), and one discipline reminder. Do not repeat every check. Never predict price with certainty. ${
                  lang === "bn" ? "Write in simple Bangla (বাংলা script); keep symbols, numbers and terms like SL, TP, R in English." : "Write in clear, simple English."
                }`,
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: JSON.stringify({
                    planned,
                    account: { currency: result.account.currency, balance: result.account.balance },
                    verdict: result.verdict,
                    checks: result.checks.map((c) => ({ level: c.level, title: c.title, detail: c.detail })),
                  }),
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        },
        25_000,
      );
      ai =
        reply.candidates?.[0]?.content?.parts
          ?.filter((p) => p.text && !p.thought)
          .map((p) => p.text)
          .join("")
          .trim() || null;
    } catch (e) {
      console.warn("[pretrade] AI opinion skipped", e instanceof Error ? e.message : e);
    }
  }
  return { ok: true, verdict: result.verdict, checks: result.checks, ai, account: result.account };
}

type Done = { ok: true; message: string } | { ok: false; error: string };

/** One click on an action button the coach suggested. */
export async function runCoachAction(input: unknown): Promise<Done> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const parsed = coachAction.safeParse(input);
  if (!parsed.success) return { ok: false, error: "This suggestion can't be applied." };
  const a = parsed.data;
  const saveSettings = (patch: Partial<UserSettings>) =>
    db.update(userTable).set({ settings: { ...user.settings, ...patch } }).where(eq(userTable.id, user.id));
  switch (a.type) {
    case "goal": {
      const m = GOAL_METRICS[a.metric];
      if (!m.periods.includes(a.period)) return { ok: false, error: `${m.label} can't be set per ${a.period.toLowerCase()}.` };
      if (a.metric === "WIN_RATE" && a.target > 100) return { ok: false, error: "Win rate is at most 100%." };
      const target = a.metric === "MAX_TRADES" || a.metric === "GREEN_DAYS" ? Math.round(a.target) : a.target;
      await db.insert(goal).values({ userId: user.id, accountId: null, metric: a.metric, period: a.period, target });
      revalidatePath("/", "layout");
      return { ok: true, message: `Goal added: ${PERIOD_LABEL[a.period]} ${m.label.toLowerCase()} ${target}` };
    }
    case "checklist": {
      const list = user.settings.dailyChecklist ?? [];
      if (list.some((i) => i.toLowerCase() === a.item.toLowerCase())) return { ok: true, message: "Already on your daily checklist." };
      if (list.length >= 30) return { ok: false, error: "Your daily checklist is full (30 items)." };
      await saveSettings({ dailyChecklist: [...list, a.item] });
      revalidatePath("/", "layout");
      return { ok: true, message: "Added to your daily checklist." };
    }
    case "cooldown":
      await saveSettings({ cooldownMinutes: a.minutes });
      revalidatePath("/", "layout");
      return { ok: true, message: a.minutes ? `Cooldown after a loss: ${a.minutes} min.` : "Cooldown turned off." };
    case "news_window":
      await saveSettings({ newsBefore: a.before, newsAfter: a.after });
      revalidatePath("/", "layout");
      return { ok: true, message: `No-trade window: ${a.before} min before to ${a.after} min after high-impact news.` };
    case "memory": {
      const [{ n }] = await db.select({ n: count() }).from(coachMemory).where(eq(coachMemory.userId, user.id));
      if (n >= MAX_MEMORIES) return { ok: false, error: "Coach memory is full. Delete something first." };
      await db.insert(coachMemory).values({ userId: user.id, text: a.text });
      return { ok: true, message: "Coach will remember this." };
    }
  }
}

export async function listCoachMemories() {
  const user = await getCurrentUser();
  if (!user) return [];
  return (await listMemories(user.id)).map((m) => ({ id: m.id, text: m.text }));
}

export async function addCoachMemory(text: string): Promise<Done> {
  return runCoachAction({ type: "memory", text, label: "memory" });
}

export async function deleteCoachMemory(id: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const };
  await db.delete(coachMemory).where(and(eq(coachMemory.id, z.string().max(64).parse(id)), eq(coachMemory.userId, user.id)));
  return { ok: true as const };
}

/** 👍 / 👎 on an answer (0 clears). */
export async function rateCoachMessage(id: string, value: -1 | 0 | 1) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const };
  const v = z.union([z.literal(-1), z.literal(0), z.literal(1)]).parse(value);
  const mine = db.select({ id: coachConversation.id }).from(coachConversation).where(eq(coachConversation.userId, user.id));
  await db
    .update(coachMessage)
    .set({ feedback: v || null })
    .where(and(eq(coachMessage.id, z.string().max(64).parse(id)), inArray(coachMessage.conversationId, mine)));
  return { ok: true as const };
}

/** Copy an answer into the notebook ("AI Coach" folder). */
export async function saveCoachAnswerToNotebook(id: string): Promise<{ ok: true; noteId: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const [row] = await db
    .select({ content: coachMessage.content, title: coachConversation.title })
    .from(coachMessage)
    .innerJoin(coachConversation, eq(coachConversation.id, coachMessage.conversationId))
    .where(and(eq(coachMessage.id, z.string().max(64).parse(id)), eq(coachConversation.userId, user.id)))
    .limit(1);
  if (!row) return { ok: false, error: "Answer not found." };
  const [n] = await db
    .insert(note)
    .values({ userId: user.id, folder: "AI Coach", title: row.title.slice(0, 160), content: markdownToDoc(row.content) })
    .returning({ id: note.id });
  revalidatePath("/notebook");
  return { ok: true, noteId: n.id };
}

const prefs = z.object({
  coachLanguage: z.enum(["auto", "en", "bn"]).optional(),
  coachDailyReport: z.boolean().optional(),
  coachWeeklyReport: z.boolean().optional(),
});

export async function saveCoachPrefs(input: z.input<typeof prefs>) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const };
  const data = prefs.parse(input);
  await db.update(userTable).set({ settings: { ...user.settings, ...data } }).where(eq(userTable.id, user.id));
  revalidatePath("/coach");
  return { ok: true as const };
}
