import "server-only";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { coachConversation, coachMessage, coachReport, trade, tradingAccount, user as userTable, type User } from "@/db/schema";
import { aiConfigured, chatWithTools } from "@/lib/ai/gemini";
import { addDays, formatDay, startOfWeek, todayIn, weekday, type WeekStart } from "@/lib/dates";
import { coachSystem } from "@/server/coach/prompt";
import { COACH_TOOLS, coachContext, listMemories, runCoachTool } from "@/server/coach/tools";
import { sendAlert } from "@/server/services/alerts";

export type ReportKind = "daily" | "weekly";

/** The period a report covers: yesterday, or last week (both in the user's timezone). */
export function reportPeriod(kind: ReportKind, today: string, ws: WeekStart, includeToday = false) {
  if (kind === "daily") {
    const day = includeToday ? today : addDays(today, -1);
    return { from: day, to: day };
  }
  const from = addDays(startOfWeek(today, ws), -7);
  return { from, to: addDays(from, 6) };
}

const langOf = (u: User): "en" | "bn" => (u.settings.coachLanguage === "bn" ? "bn" : u.settings.coachLanguage === "en" ? "en" : (u.settings.aiLanguage ?? "en"));

function reportPrompt(kind: ReportKind, from: string, to: string, lang: "en" | "bn") {
  const label = kind === "daily" ? formatDay(from, { weekday: "long", day: "numeric", month: "long" }) : `${from} to ${to}`;
  return `${
    kind === "daily"
      ? `Write my end-of-day trading review for ${label} (from=${from}, to=${to}).`
      : `Write my weekly trading review for ${label} (from=${from}, to=${to}), then preview the coming week.`
  }
Use the tools: get_performance and list_trades for that period, get_psychology for behaviour patterns${kind === "weekly" ? ", get_news (days_ahead 7) for the coming week" : ", get_news (days_ahead 1) for today's releases"}.
Structure:
1. A cards block with net P&L, trades, win rate and one key number.
2. What went well (with evidence).
3. Mistakes, with the specific trades linked and why they hurt.
4. ${kind === "weekly" ? "A chart of P&L by day or symbol, and the high-impact news to watch next week with times." : "Today's high-impact news to watch, with times."}
5. One callout with THE rule to follow ${kind === "weekly" ? "this week" : "today"}, and an action block turning it into a setting or goal.
Be concise. ${lang === "bn" ? "Write in Bangla (বাংলা script)." : "Write in English."}`;
}

/** Generate (or return the existing) report for a period; null when there were no trades. */
export async function generateCoachReport(u: User, kind: ReportKind, opts: { today?: string; force?: boolean; includeToday?: boolean } = {}) {
  const tz = u.timezone;
  const today = opts.today ?? todayIn(tz);
  const ws = (u.settings.weekStartsOn ?? 1) as WeekStart;
  const { from, to } = reportPeriod(kind, today, ws, opts.includeToday);
  const [existing] = await db
    .select()
    .from(coachReport)
    .where(and(eq(coachReport.userId, u.id), eq(coachReport.kind, kind), eq(coachReport.period, from)))
    .limit(1);
  if (existing && !opts.force) return existing;

  // Skip quiet periods: no closed live trades, nothing to review.
  const start = new Date(new Date(`${from}T00:00:00Z`).getTime() - 14 * 3_600_000);
  const end = new Date(new Date(`${to}T23:59:59Z`).getTime() + 14 * 3_600_000);
  const [{ n }] = await db
    .select({ n: count() })
    .from(trade)
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .where(and(eq(tradingAccount.userId, u.id), eq(trade.status, "CLOSED"), eq(trade.isBacktest, false), gte(trade.closeTime, start), lte(trade.closeTime, end)));
  if (n === 0) return null;

  const lang = langOf(u);
  const [ctx, memories] = await Promise.all([coachContext(u), listMemories(u.id).catch(() => [])]);
  const prompt = reportPrompt(kind, from, to, lang);
  const answer = await chatWithTools({
    system: coachSystem({ ...ctx, dataMode: "live", baseCurrency: u.baseCurrency, language: lang, memories }),
    history: [{ role: "user", parts: [{ text: prompt }] }],
    tools: COACH_TOOLS.filter((t) => t.name !== "remember" && t.name !== "forget"),
    runTool: (name, args) => runCoachTool(u, name, args),
    budgetMs: 100_000,
  });

  // The review lives in a chat so the trader can ask follow-up questions.
  const title =
    kind === "daily"
      ? `${lang === "bn" ? "দিনের রিভিউ" : "Daily review"} · ${formatDay(from, { day: "numeric", month: "short" })}`
      : `${lang === "bn" ? "সাপ্তাহিক রিভিউ" : "Weekly review"} · ${formatDay(from, { day: "numeric", month: "short" })}–${formatDay(to, { day: "numeric", month: "short" })}`;
  const [conv] = await db.insert(coachConversation).values({ userId: u.id, title }).returning({ id: coachConversation.id });
  await db.insert(coachMessage).values({ conversationId: conv.id, role: "user", content: title });
  await db.insert(coachMessage).values({
    conversationId: conv.id,
    role: "assistant",
    content: answer.text,
    toolsUsed: [...new Set(answer.toolsUsed)],
    model: answer.model,
    // Keep order: the answer must sort after the question.
    createdAt: new Date(Date.now() + 1),
  });
  const values = { userId: u.id, kind, period: from, language: lang, content: answer.text, model: answer.model, conversationId: conv.id, readAt: null };
  const [row] = await db
    .insert(coachReport)
    .values(values)
    .onConflictDoUpdate({ target: [coachReport.userId, coachReport.kind, coachReport.period], set: { ...values, createdAt: new Date() } })
    .returning();
  await sendAlert(u, {
    kind: "REVIEW",
    key: `${kind}-${from}`,
    title: lang === "bn" ? `📊 ${title} তৈরি` : `📊 ${title} is ready`,
    body: excerpt(answer.text),
    url: `/coach?c=${conv.id}`,
  }).catch((e) => console.warn("[coach] review alert failed", e));
  return row;
}

/** First plain sentences of a markdown answer, for a notification. */
function excerpt(md: string, max = 180) {
  const t = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s.*$/gm, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

/** Cron: yesterday's review for everyone, last week's on the first day of their week. */
export async function runCoachReports(budgetMs = 200_000) {
  const out = { daily: 0, weekly: 0, skipped: 0, errors: 0 };
  if (!aiConfigured()) return out;
  const started = Date.now();
  const users = await db.select().from(userTable).where(eq(userTable.onboarded, true));
  for (const u of users) {
    for (const kind of ["weekly", "daily"] as const) {
      if (Date.now() - started > budgetMs) return { ...out, stoppedEarly: true };
      if (kind === "daily" && u.settings.coachDailyReport === false) continue;
      if (kind === "weekly" && (u.settings.coachWeeklyReport === false || weekday(todayIn(u.timezone)) !== (u.settings.weekStartsOn ?? 1))) continue;
      try {
        const r = await generateCoachReport(u, kind);
        if (r) out[kind]++;
        else out.skipped++;
      } catch (e) {
        out.errors++;
        console.error(`[coach] ${kind} report failed for`, u.id, e);
      }
    }
  }
  return out;
}

export async function latestCoachReport(userId: string) {
  const [r] = await db
    .select({
      id: coachReport.id,
      kind: coachReport.kind,
      period: coachReport.period,
      content: coachReport.content,
      conversationId: coachReport.conversationId,
      readAt: coachReport.readAt,
      createdAt: coachReport.createdAt,
    })
    .from(coachReport)
    .where(and(eq(coachReport.userId, userId), gte(coachReport.createdAt, new Date(Date.now() - 8 * 86_400_000))))
    .orderBy(desc(coachReport.createdAt))
    .limit(1);
  return r ?? null;
}
