"use server";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { aiInsight, journalEntry, setup, tag, trade, tradeTag, tradingAccount, user as userTable } from "@/db/schema";
import { buildReviewContext, REVIEW_SYSTEM, TRADE_SYSTEM } from "@/lib/ai/context";
import { AiError, aiModel, generateJson } from "@/lib/ai/gemini";
import { reviewResponseSchema, reviewSchema, tradeFeedbackResponseSchema, tradeFeedbackSchema, type Review, type TradeFeedback } from "@/lib/ai/schemas";
import { addDays, todayIn, type WeekStart } from "@/lib/dates";
import { docToText } from "@/lib/doc";
import { GOAL_METRICS, PERIOD_LABEL } from "@/lib/goals";
import { resolvePeriod } from "@/lib/periods";
import { getCurrentUser, getSelectedAccountIds } from "@/lib/session";
import { formatDuration } from "@/lib/trading/metrics";
import { getAnalyticsTrades } from "@/server/queries/analytics";
import { getGoalsWithProgress } from "@/server/queries/goals";

const PRESETS = ["last_week", "this_week", "last_month", "this_month", "last_30"] as const;
export type ReviewPreset = (typeof PRESETS)[number];

type Result<T> = { ok: true; id: string; data: T } | { ok: false; error: string };

async function checkQuota(userId: string) {
  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiInsight)
    .where(and(eq(aiInsight.userId, userId), gte(aiInsight.createdAt, new Date(Date.now() - 60_000))));
  if (recent.n > 0) return "One AI request per minute, please — try again shortly.";
  const [day] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiInsight)
    .where(and(eq(aiInsight.userId, userId), gte(aiInsight.createdAt, new Date(Date.now() - 86_400_000))));
  if (day.n >= 30) return "You've used today's 30 AI requests. Try again tomorrow.";
  return null;
}

function rangeFor(preset: ReviewPreset, today: string, ws: WeekStart) {
  switch (preset) {
    case "this_week":
      return resolvePeriod("week", today, ws);
    case "last_week":
      return resolvePeriod("week", addDays(today, -7), ws);
    case "this_month":
      return resolvePeriod("month", today, ws);
    case "last_month":
      // Any day in the previous month: the day before this month started.
      return resolvePeriod("month", addDays(`${today.slice(0, 7)}-01`, -1), ws);
    default:
      return resolvePeriod("custom", today, ws, { from: addDays(today, -29), to: today });
  }
}

export async function generateReview(input: { preset: ReviewPreset; language: "en" | "bn" }): Promise<Result<Review>> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Please sign in again." };
  const preset = z.enum(PRESETS).parse(input.preset);
  const language = z.enum(["en", "bn"]).parse(input.language);
  const quota = await checkQuota(u.id);
  if (quota) return { ok: false, error: quota };

  const ws = (u.settings.weekStartsOn ?? 1) as WeekStart;
  const today = todayIn(u.timezone);
  const range = rangeFor(preset, today, ws);
  const { ids } = await getSelectedAccountIds(u.id);
  const [{ trades, currency }, prev] = await Promise.all([
    getAnalyticsTrades(u.id, ids, range.from, range.to, u.timezone),
    getAnalyticsTrades(u.id, ids, range.prev.from, range.prev.to, u.timezone),
  ]);
  if (trades.length < 3) return { ok: false, error: "Need at least 3 closed trades in this period for a useful review." };

  const [journal, noteRows, goals] = await Promise.all([
    db
      .select()
      .from(journalEntry)
      .where(and(eq(journalEntry.userId, u.id), gte(journalEntry.day, range.from), sql`${journalEntry.day} <= ${range.to}`))
      .orderBy(desc(journalEntry.day)),
    db
      .select({ id: trade.id, notes: trade.notes })
      .from(trade)
      .where(and(eq(trade.userId, u.id), inArray(trade.id, trades.map((t) => t.id)))),
    getGoalsWithProgress(u, true),
  ]);

  const context = buildReviewContext({
    periodLabel: range.label,
    currency,
    trades,
    previous: prev.trades,
    journal: journal.map((j) => ({
      day: j.day,
      mood: j.mood,
      bias: j.premarket?.bias ?? null,
      plan: docToText(j.premarket?.plan, 400),
      wentWell: docToText(j.review?.wentWell, 400),
      improve: docToText(j.review?.improve, 400),
      lessons: docToText(j.review?.lessons, 400),
    })),
    notes: noteRows.map((n) => ({ id: n.id, text: (n.notes as { text?: string } | null)?.text ?? "" })).filter((n) => n.text),
    goals: goals.map((g) => `${PERIOD_LABEL[g.period]} ${GOAL_METRICS[g.metric].label}: ${g.target} (current period: ${g.current.status})`),
  });

  try {
    const review = await generateJson({
      system: REVIEW_SYSTEM(language),
      prompt: `Review this trading period and return the JSON described by the schema.\n\nDATA:\n${JSON.stringify(context)}`,
      responseSchema: reviewResponseSchema,
      validate: reviewSchema,
    });
    const [row] = await db
      .insert(aiInsight)
      .values({
        userId: u.id,
        scope: preset === "last_30" ? "RANGE" : preset.endsWith("week") ? "WEEK" : "MONTH",
        rangeStart: range.from,
        rangeEnd: range.to,
        accountIds: ids,
        content: { review, language, periodLabel: range.label, trades: trades.length, net: context.overall.net, currency },
        model: aiModel(),
      })
      .returning({ id: aiInsight.id });
    if (language !== u.settings.aiLanguage) {
      await db.update(userTable).set({ settings: { ...u.settings, aiLanguage: language } }).where(eq(userTable.id, u.id));
    }
    revalidatePath("/insights");
    return { ok: true, id: row.id, data: review };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong generating the review." };
  }
}

export async function reviewTrade(tradeId: string, language: "en" | "bn"): Promise<Result<TradeFeedback>> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Please sign in again." };
  const lang = z.enum(["en", "bn"]).parse(language);
  const quota = await checkQuota(u.id);
  if (quota) return { ok: false, error: quota };

  const [row] = await db
    .select({ t: trade, currency: tradingAccount.currency, setupName: setup.name, rules: setup.rules, checklist: setup.checklist })
    .from(trade)
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .leftJoin(setup, eq(setup.id, trade.setupId))
    .where(and(eq(trade.id, tradeId), eq(trade.userId, u.id)))
    .limit(1);
  if (!row) return { ok: false, error: "Trade not found." };
  const tags = await db
    .select({ name: tag.name, kind: tag.kind })
    .from(tradeTag)
    .innerJoin(tag, eq(tag.id, tradeTag.tagId))
    .where(eq(tradeTag.tradeId, tradeId));
  const t = row.t;

  const context = {
    symbol: t.symbol,
    side: t.side,
    status: t.status,
    currency: row.currency,
    entry: t.openPrice,
    exit: t.closePrice,
    stopLoss: t.sl,
    takeProfit: t.tp,
    lots: t.volume,
    netPnl: t.netPnl,
    pips: t.pips,
    rMultiple: t.rMultiple,
    held: formatDuration(t.durationSec),
    session: t.session,
    setup: row.setupName ? { name: row.setupName, rules: row.rules, entryChecklist: row.checklist } : null,
    selfRating: t.rating,
    emotionBefore: t.emotionBefore,
    emotionAfter: t.emotionAfter,
    followedPlan: t.followedPlan,
    mistakesTagged: tags.filter((g) => g.kind === "MISTAKE").map((g) => g.name),
    tags: tags.filter((g) => g.kind === "TAG").map((g) => g.name),
    notes: ((t.notes as { text?: string } | null)?.text ?? "").slice(0, 1500) || null,
  };

  try {
    const feedback = await generateJson({
      system: TRADE_SYSTEM(lang),
      prompt: `Give feedback on this trade and return the JSON described by the schema.\n\nTRADE:\n${JSON.stringify(context)}`,
      responseSchema: tradeFeedbackResponseSchema,
      validate: tradeFeedbackSchema,
    });
    const [ins] = await db
      .insert(aiInsight)
      .values({ userId: u.id, scope: "TRADE", tradeId, content: { feedback, language: lang }, model: aiModel() })
      .returning({ id: aiInsight.id });
    return { ok: true, id: ins.id, data: feedback };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong reviewing this trade." };
  }
}

export async function deleteInsight(id: string) {
  const u = await getCurrentUser();
  if (!u) return;
  await db.delete(aiInsight).where(and(eq(aiInsight.id, id), eq(aiInsight.userId, u.id)));
  revalidatePath("/insights");
}
