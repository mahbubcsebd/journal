/**
 * Performance by trading session (the session a trade was opened in, by UTC
 * hour — see marketSession). Pure.
 */
import type { ATrade } from "./analytics";
import { SESSION_LABEL, type MarketSession } from "./trading/metrics";

export const SESSION_ORDER: MarketSession[] = ["ASIA", "LONDON", "LONDON_NY_OVERLAP", "NEW_YORK", "OFF_HOURS"];
export const SESSION_HOURS_UTC: Record<MarketSession, string> = {
  ASIA: "23:00–07:00",
  LONDON: "07:00–12:00",
  LONDON_NY_OVERLAP: "12:00–16:00",
  NEW_YORK: "16:00–21:00",
  OFF_HOURS: "21:00–23:00",
};
/** Chart colour tokens, one per session. */
export const SESSION_COLOR: Record<MarketSession, string> = {
  ASIA: "var(--chart-2)",
  LONDON: "var(--chart-1)",
  LONDON_NY_OVERLAP: "var(--chart-3)",
  NEW_YORK: "var(--chart-4)",
  OFF_HOURS: "var(--chart-6)",
};

export type SessionRow = {
  key: MarketSession;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  net: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  expectancy: number | null;
  avgHoldSec: number | null;
  share: number;
  /** Net by weekday (0 = Sunday … 6). */
  weekday: number[];
  best: { symbol: string; net: number; trades: number } | null;
  worst: { symbol: string; net: number; trades: number } | null;
};

export function sessionStats(trades: ATrade[]) {
  const total = trades.length;
  const rows: SessionRow[] = SESSION_ORDER.map((key) => {
    const ts = trades.filter((t) => (t.session ?? "OFF_HOURS") === key);
    const wins = ts.filter((t) => t.net > 0);
    const losses = ts.filter((t) => t.net < 0);
    const gp = wins.reduce((s, t) => s + t.net, 0);
    const gl = losses.reduce((s, t) => s + t.net, 0);
    const holds = ts.map((t) => t.durationSec).filter((d): d is number => d != null);
    const bySym = new Map<string, { net: number; trades: number }>();
    for (const t of ts) {
      const r = bySym.get(t.symbol) ?? { net: 0, trades: 0 };
      r.net += t.net;
      r.trades++;
      bySym.set(t.symbol, r);
    }
    const syms = [...bySym.entries()].map(([symbol, v]) => ({ symbol, ...v })).sort((a, b) => b.net - a.net);
    const weekday = [0, 0, 0, 0, 0, 0, 0];
    for (const t of ts) weekday[t.weekday] += t.net;
    return {
      key,
      label: SESSION_LABEL[key],
      trades: ts.length,
      wins: wins.length,
      losses: losses.length,
      winRate: wins.length + losses.length ? wins.length / (wins.length + losses.length) : null,
      net: ts.reduce((s, t) => s + t.net, 0),
      grossProfit: gp,
      grossLoss: gl,
      profitFactor: gl ? gp / Math.abs(gl) : null,
      expectancy: ts.length ? ts.reduce((s, t) => s + t.net, 0) / ts.length : null,
      avgHoldSec: holds.length ? holds.reduce((s, d) => s + d, 0) / holds.length : null,
      share: total ? ts.length / total : 0,
      weekday,
      best: syms[0] && syms[0].net > 0 ? syms[0] : null,
      worst: syms.length && syms[syms.length - 1].net < 0 ? syms[syms.length - 1] : null,
    };
  });

  // Insights need a few trades to mean anything.
  const ranked = rows.filter((r) => r.trades >= 5).sort((a, b) => (b.expectancy ?? 0) - (a.expectancy ?? 0));
  const totalLoss = rows.reduce((s, r) => s + r.grossLoss, 0);
  const lossLeader = [...rows].sort((a, b) => a.grossLoss - b.grossLoss)[0];
  return {
    rows,
    total,
    best: ranked[0] && (ranked[0].expectancy ?? 0) > 0 ? ranked[0] : null,
    worst: ranked.length > 1 && (ranked[ranked.length - 1].expectancy ?? 0) < 0 ? ranked[ranked.length - 1] : null,
    /** Session that produced the biggest share of all losing money. */
    lossShare: totalLoss < 0 && lossLeader.grossLoss < 0 ? { row: lossLeader, share: lossLeader.grossLoss / totalLoss } : null,
  };
}
