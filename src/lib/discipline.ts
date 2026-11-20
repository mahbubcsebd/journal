/**
 * Discipline score: did each trade follow the trader's own rules? Money is not
 * part of it — a losing trade that followed the plan scores 100. Pure.
 */
import type { ATrade } from "./analytics";
import { DEFAULT_COOLDOWN_MINUTES } from "./mindset";
import { newsTrades, type NewsWindow } from "./news";
import { normalizeSymbol } from "./trading/symbols";

export type Rule = "no_sl" | "news" | "revenge" | "overtrade" | "past_limit" | "ignored_check";

/** Points taken off a trade for each broken rule. */
export const RULE_WEIGHT: Record<Rule, number> = { no_sl: 25, news: 25, revenge: 25, past_limit: 30, ignored_check: 20, overtrade: 15 };

export const RULE_TEXT: Record<Rule, { en: string; bn: string }> = {
  no_sl: { en: "No stop loss", bn: "স্টপ লস ছাড়া" },
  news: { en: "Opened in a news window", bn: "নিউজ উইন্ডোতে ট্রেড" },
  revenge: { en: "Revenge trade (during cooldown)", bn: "রিভেঞ্জ ট্রেড (কুলডাউনে)" },
  overtrade: { en: "Over your daily trade limit", bn: "দিনের ট্রেড লিমিটের বেশি" },
  past_limit: { en: "After the daily loss limit", bn: "দিনের লস লিমিটের পরে" },
  ignored_check: { en: "Pre-trade check said no", bn: "চেক 'না' বলার পরও ট্রেড" },
};

export type DTrade = {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  /** Open day in the trader's time zone. */
  day: string;
  openAt: number;
  closeAt: number | null;
  net: number | null;
  sl: number | null;
};

export type DisciplineContext = {
  window: NewsWindow;
  events: { id: string; title: string; currency: string; impact: string; time: Date | string; allDay?: boolean }[];
  cooldownMinutes?: number;
  maxTradesPerDay?: number | null;
  dailyMaxLoss?: number | null;
  /** Pre-trade checks that said "stop". */
  stopChecks?: { symbol: string; side: "LONG" | "SHORT"; at: number }[];
};

export type TradeVerdict = { trade: DTrade; rules: Rule[]; score: number };
export type DayScore = { day: string; score: number; trades: number; clean: number; rules: Partial<Record<Rule, number>> };

export function scoreTrades(trades: DTrade[], ctx: DisciplineContext): TradeVerdict[] {
  const sorted = [...trades].sort((a, b) => a.openAt - b.openAt);
  const cooldown = (ctx.cooldownMinutes || DEFAULT_COOLDOWN_MINUTES) * 60_000;
  const newsIds = new Set(newsTrades(sorted.map((t) => ({ id: t.id, symbol: t.symbol, openAt: t.openAt }) as ATrade), ctx.events, ctx.window).map((h) => h.trade.id));
  const losses = sorted.filter((t) => t.closeAt != null && (t.net ?? 0) < 0);
  const perDay = new Map<string, number>();

  return sorted.map((t) => {
    const rules: Rule[] = [];
    if (t.sl == null || t.sl === 0) rules.push("no_sl");
    if (newsIds.has(t.id)) rules.push("news");
    if (losses.some((l) => l.id !== t.id && l.closeAt! <= t.openAt && l.closeAt! > t.openAt - cooldown)) rules.push("revenge");
    const n = (perDay.get(t.day) ?? 0) + 1;
    perDay.set(t.day, n);
    if (ctx.maxTradesPerDay && n > ctx.maxTradesPerDay) rules.push("overtrade");
    if (ctx.dailyMaxLoss) {
      const lostBefore = sorted
        .filter((x) => x.day === t.day && x.closeAt != null && x.closeAt <= t.openAt)
        .reduce((s, x) => s + (x.net ?? 0), 0);
      if (lostBefore <= -ctx.dailyMaxLoss) rules.push("past_limit");
    }
    const sym = normalizeSymbol(t.symbol);
    if (ctx.stopChecks?.some((c) => normalizeSymbol(c.symbol) === sym && c.side === t.side && c.at <= t.openAt && c.at > t.openAt - 60 * 60_000)) rules.push("ignored_check");
    return { trade: t, rules, score: Math.max(0, 100 - rules.reduce((s, r) => s + RULE_WEIGHT[r], 0)) };
  });
}

/** Average trade score per day (days without trades are left out). */
export function scoreDays(verdicts: TradeVerdict[]): DayScore[] {
  const map = new Map<string, TradeVerdict[]>();
  for (const v of verdicts) map.set(v.trade.day, [...(map.get(v.trade.day) ?? []), v]);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, vs]) => {
      const rules: Partial<Record<Rule, number>> = {};
      for (const v of vs) for (const r of v.rules) rules[r] = (rules[r] ?? 0) + 1;
      return { day, score: Math.round(vs.reduce((s, v) => s + v.score, 0) / vs.length), trades: vs.length, clean: vs.filter((v) => !v.rules.length).length, rules };
    });
}

/** Totals over a period: overall score, rule counts (most broken first), streak of 80+ days. */
export function disciplineSummary(days: DayScore[]) {
  const trades = days.reduce((s, d) => s + d.trades, 0);
  const score = trades ? Math.round(days.reduce((s, d) => s + d.score * d.trades, 0) / trades) : null;
  const totals: Partial<Record<Rule, number>> = {};
  for (const d of days) for (const [r, n] of Object.entries(d.rules) as [Rule, number][]) totals[r] = (totals[r] ?? 0) + n;
  let streak = 0;
  for (let i = days.length - 1; i >= 0 && days[i].score >= 80; i--) streak++;
  return {
    score,
    trades,
    clean: days.reduce((s, d) => s + d.clean, 0),
    rules: (Object.entries(totals) as [Rule, number][]).sort((a, b) => b[1] - a[1]),
    streak,
  };
}

export const scoreTone = (s: number | null) => (s == null ? "muted" : s >= 80 ? "profit" : s >= 60 ? "warning" : "loss");
