import { groupBy, performance, tiltPatterns, type ATrade, type GroupRow } from "../analytics";
import { weekdayLabels } from "../dates";
import { equityCurve, maxDrawdown } from "../stats";

/**
 * Turn trades + journal text into a compact, anonymous JSON summary for the
 * model. No names, emails, account numbers or broker credentials are included;
 * free text comes only from the trader's own journal and notes.
 */
const r2 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 100) / 100);
const row = (g: GroupRow) => ({
  key: g.key,
  trades: g.trades,
  winRate: g.winRate == null ? null : Math.round(g.winRate * 100),
  net: r2(g.net),
  expectancy: r2(g.expectancy),
  profitFactor: r2(g.profitFactor),
  avgR: g.avgR,
});
const clip = (s: string | null | undefined, n: number) => (s ? (s.length > n ? s.slice(0, n) + "…" : s) : undefined);

export type JournalSnippet = { day: string; mood: number | null; bias?: string | null; plan?: string; wentWell?: string; improve?: string; lessons?: string };
export type TradeNote = { id: string; text: string };

export function buildReviewContext(input: {
  periodLabel: string;
  currency: string;
  trades: ATrade[];
  previous?: ATrade[];
  journal: JournalSnippet[];
  notes: TradeNote[];
  goals: string[];
}) {
  const { trades } = input;
  const p = performance(trades);
  const byDay = new Map<string, number>();
  for (const t of trades) byDay.set(t.day, (byDay.get(t.day) ?? 0) + t.net);
  const days = [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, net]) => ({ day, net, trades: 0, wins: 0, losses: 0 }));
  const tilt = tiltPatterns(trades);
  const noteById = new Map(input.notes.map((n) => [n.id, n.text]));
  const sorted = [...trades].sort((a, b) => b.net - a.net);
  const notable = [...sorted.slice(0, 3), ...sorted.slice(-3).reverse()].filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);
  const significant = (rows: GroupRow[]) => rows.filter((r) => r.trades >= 2).map(row);
  const wd = weekdayLabels(0);

  return {
    period: input.periodLabel,
    currency: input.currency,
    overall: {
      trades: p.trades,
      net: r2(p.net),
      winRate: p.winRate == null ? null : Math.round(p.winRate * 100),
      profitFactor: r2(p.profitFactor),
      expectancy: r2(p.expectancy),
      avgWin: r2(p.avgWin),
      avgLoss: r2(p.avgLoss),
      avgR: p.avgR,
      largestWin: r2(p.largestWin),
      largestLoss: r2(p.largestLoss),
      maxDrawdown: r2(maxDrawdown(equityCurve(days))),
      tradingDays: days.length,
      greenDays: days.filter((d) => d.net > 0).length,
      maxConsecutiveLosses: p.maxLosses,
      avgHoldWinMinutes: p.avgHoldWin == null ? null : Math.round(p.avgHoldWin / 60),
      avgHoldLossMinutes: p.avgHoldLoss == null ? null : Math.round(p.avgHoldLoss / 60),
      tradesWithStopLossPct: trades.length ? Math.round((trades.filter((t) => t.rMultiple != null).length / trades.length) * 100) : null,
    },
    previousPeriod: input.previous?.length
      ? (() => {
          const q = performance(input.previous!);
          return { trades: q.trades, net: r2(q.net), winRate: q.winRate == null ? null : Math.round(q.winRate * 100), expectancy: r2(q.expectancy) };
        })()
      : null,
    bySymbol: significant(groupBy(trades, (t) => t.symbol)).slice(0, 8),
    bySide: groupBy(trades, (t) => t.side).map(row),
    bySession: significant(groupBy(trades, (t) => t.session)),
    byWeekday: significant(groupBy(trades, (t) => wd[t.weekday])),
    byOpenHour: significant(groupBy(trades, (t) => `${String(t.hour).padStart(2, "0")}:00`)).sort((a, b) => (b.net ?? 0) - (a.net ?? 0)),
    bySetup: significant(groupBy(trades, (t) => t.setup ?? "No setup")),
    byMistake: groupBy(trades, (t) => t.tags.filter((g) => g.kind === "MISTAKE").map((g) => g.name)).map(row),
    byEmotionBefore: significant(groupBy(trades, (t) => t.emotionBefore)),
    planAdherence: groupBy(trades, (t) => (t.followedPlan == null ? null : t.followedPlan ? "followed" : "broke")).map(row),
    tilt: {
      revengeTrades: row(tilt.revenge),
      sizeUpAfterLoss: row(tilt.sizedUp),
      afterTwoLosses: row(tilt.afterStreak),
      overtradingDays: { days: tilt.overtrading.days, ...row(tilt.overtrading) },
    },
    notableTrades: notable.map((t) => ({
      day: t.day,
      symbol: t.symbol,
      side: t.side,
      net: r2(t.net),
      r: t.rMultiple,
      holdMinutes: t.durationSec == null ? null : Math.round(t.durationSec / 60),
      setup: t.setup,
      emotion: t.emotionBefore,
      followedPlan: t.followedPlan,
      mistakes: t.tags.filter((g) => g.kind === "MISTAKE").map((g) => g.name),
      note: clip(noteById.get(t.id), 280),
    })),
    journal: input.journal.slice(0, 12).map((j) => ({
      day: j.day,
      mood: j.mood,
      bias: j.bias ?? undefined,
      plan: clip(j.plan, 240),
      wentWell: clip(j.wentWell, 240),
      improve: clip(j.improve, 240),
      lessons: clip(j.lessons, 240),
    })),
    goals: input.goals,
  };
}

export const REVIEW_SYSTEM = (language: "en" | "bn") => `You are an experienced, honest trading coach reviewing one trader's journal data from their own Exness MT5 accounts.
Rules:
- Base every statement on the JSON provided. Quote concrete numbers (net P&L, win rate, expectancy, R, counts) as evidence. Never invent trades or figures.
- Groups with few trades are weak evidence: say so instead of over-claiming.
- Focus on behaviour the trader controls: risk per trade, stop losses, setups, timing, discipline, emotions, overtrading, revenge trading.
- Be direct and specific, kind but not flattering. No generic advice like "stay disciplined" without saying exactly how.
- Do not give financial advice or predict markets. Do not recommend specific instruments to buy or sell.
- "actions" must be 3 concrete, measurable rules for the next period (e.g. "Stop after 2 losses in a day").
- grade: A = excellent process and results, F = serious discipline problems. Judge process more than profit.
- Money amounts are in the currency named in the data.
${language === "bn" ? "- Write every text field in Bengali (বাংলা). Keep symbols, numbers and trading terms like R, stop loss, win rate as they are." : "- Write in clear, plain English."}`;

export const TRADE_SYSTEM = (language: "en" | "bn") => `You are a trading coach giving feedback on ONE trade from the trader's own journal.
- Judge the process (entry reason, stop, size, management, emotions, rule adherence), not just the outcome. A losing trade can be a good trade.
- If the setup has rules, check the trade against them in "ruleCheck"; if there are none, say what information is missing.
- Use only the data given; never invent price action you weren't told about.
- score: 1–10 for execution quality.
- No financial advice or market predictions.
${language === "bn" ? "- Write every text field in Bengali (বাংলা), keeping trading terms and numbers as they are." : "- Write in clear, plain English."}`;
