/**
 * Pure analytics over closed trades. `net` is already in one reporting
 * currency (cent accounts converted when mixed), so everything here can sum.
 */
export type ATrade = {
  id: string;
  day: string; // close day in user tz
  hour: number; // open hour in user tz (0-23)
  weekday: number; // open weekday in user tz (0 = Sunday)
  symbol: string;
  side: "LONG" | "SHORT";
  session: string | null;
  net: number;
  commission: number;
  swap: number;
  volume: number;
  durationSec: number | null;
  rMultiple: number | null;
  setup: string | null;
  setupId: string | null;
  tags: { name: string; kind: "TAG" | "MISTAKE" | "EMOTION" }[];
  emotionBefore: string | null;
  followedPlan: boolean | null;
  rating: number | null;
  accountName: string;
  openAt: number; // epoch ms
  closeAt: number; // epoch ms
};

export type GroupRow = {
  key: string;
  trades: number;
  wins: number;
  losses: number;
  net: number;
  grossProfit: number;
  grossLoss: number;
  winRate: number | null;
  profitFactor: number | null;
  expectancy: number;
  avgR: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

export function stdev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

export function summarize(key: string, ts: ATrade[]): GroupRow {
  const wins = ts.filter((t) => t.net > 0);
  const losses = ts.filter((t) => t.net < 0);
  const gp = sum(wins.map((t) => t.net));
  const gl = sum(losses.map((t) => t.net));
  const rs = ts.map((t) => t.rMultiple).filter((x): x is number => x != null);
  return {
    key,
    trades: ts.length,
    wins: wins.length,
    losses: losses.length,
    net: r2(gp + gl),
    grossProfit: r2(gp),
    grossLoss: r2(gl),
    winRate: wins.length + losses.length ? wins.length / (wins.length + losses.length) : null,
    profitFactor: gl ? gp / Math.abs(gl) : null,
    expectancy: ts.length ? r2((gp + gl) / ts.length) : 0,
    avgR: rs.length ? Math.round(mean(rs) * 100) / 100 : null,
  };
}

/** Group trades by one or more keys per trade (a trade with two tags lands in both). */
export function groupBy(ts: ATrade[], key: (t: ATrade) => string | string[] | null, order?: string[]): GroupRow[] {
  const map = new Map<string, ATrade[]>();
  for (const t of ts) {
    const k = key(t);
    for (const kk of k == null ? [] : Array.isArray(k) ? k : [k]) {
      const list = map.get(kk) ?? [];
      list.push(t);
      map.set(kk, list);
    }
  }
  const rows = [...map].map(([k, list]) => summarize(k, list));
  if (order) {
    const full = order.map((k) => rows.find((r) => r.key === k) ?? summarize(k, []));
    return full;
  }
  return rows.sort((a, b) => b.net - a.net);
}

export const DURATION_BUCKETS = [
  { key: "< 5m", max: 300 },
  { key: "5–15m", max: 900 },
  { key: "15–60m", max: 3600 },
  { key: "1–4h", max: 14_400 },
  { key: "4–24h", max: 86_400 },
  { key: "> 1 day", max: Infinity },
];

export function durationBucket(sec: number | null) {
  if (sec == null) return null;
  return DURATION_BUCKETS.find((b) => sec < b.max)!.key;
}

export function volumeBucket(v: number) {
  if (v < 0.05) return "< 0.05";
  if (v < 0.1) return "0.05–0.09";
  if (v < 0.5) return "0.10–0.49";
  if (v < 1) return "0.50–0.99";
  return "≥ 1.00";
}

/** Fixed-width histogram; bins are labelled by their lower edge. */
export function histogram(values: number[], binSize: number) {
  if (values.length === 0) return [];
  const lo = Math.floor(Math.min(...values) / binSize) * binSize;
  const hi = Math.floor(Math.max(...values) / binSize) * binSize;
  const bins: { from: number; to: number; count: number }[] = [];
  for (let x = lo; x <= hi + 1e-9; x = r2(x + binSize)) bins.push({ from: r2(x), to: r2(x + binSize), count: 0 });
  for (const v of values) {
    const i = Math.min(bins.length - 1, Math.floor((v - lo) / binSize + 1e-9));
    bins[i].count++;
  }
  return bins;
}

/** "Nice" bin size giving roughly `target` bins. */
export function niceBin(values: number[], target = 12) {
  if (values.length === 0) return 1;
  const span = Math.max(...values) - Math.min(...values) || Math.abs(values[0]) || 1;
  const raw = span / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
}

export type DayPnl = { day: string; net: number };

/** Risk-adjusted ratios on daily P&L (money based, since balances aren't always known). */
export function riskRatios(days: DayPnl[], maxDrawdown: number) {
  const xs = days.map((d) => d.net);
  const m = mean(xs);
  const sd = stdev(xs);
  const downside = Math.sqrt(mean(xs.map((x) => Math.min(0, x) ** 2)));
  const net = sum(xs);
  return {
    sharpe: sd ? (m / sd) * Math.sqrt(252) : null,
    sortino: downside ? (m / downside) * Math.sqrt(252) : null,
    recoveryFactor: maxDrawdown ? net / Math.abs(maxDrawdown) : null,
    dailyStdev: sd,
  };
}

export function consecutive(ts: ATrade[]) {
  let w = 0;
  let l = 0;
  let maxW = 0;
  let maxL = 0;
  for (const t of ts) {
    if (t.net > 0) {
      w++;
      l = 0;
    } else if (t.net < 0) {
      l++;
      w = 0;
    }
    maxW = Math.max(maxW, w);
    maxL = Math.max(maxL, l);
  }
  return { maxWins: maxW, maxLosses: maxL };
}

export function performance(ts: ATrade[]) {
  const all = summarize("all", ts);
  const wins = ts.filter((t) => t.net > 0);
  const losses = ts.filter((t) => t.net < 0);
  const avgWin = wins.length ? all.grossProfit / wins.length : null;
  const avgLoss = losses.length ? all.grossLoss / losses.length : null;
  const holdW = wins.map((t) => t.durationSec).filter((x): x is number => x != null);
  const holdL = losses.map((t) => t.durationSec).filter((x): x is number => x != null);
  return {
    ...all,
    avgWin,
    avgLoss,
    payoff: avgWin != null && avgLoss ? avgWin / Math.abs(avgLoss) : null,
    largestWin: wins.length ? Math.max(...wins.map((t) => t.net)) : null,
    largestLoss: losses.length ? Math.min(...losses.map((t) => t.net)) : null,
    avgHoldWin: holdW.length ? Math.round(mean(holdW)) : null,
    avgHoldLoss: holdL.length ? Math.round(mean(holdL)) : null,
    commission: r2(sum(ts.map((t) => t.commission))),
    swap: r2(sum(ts.map((t) => t.swap))),
    lots: r2(sum(ts.map((t) => t.volume))),
    ...consecutive(ts),
  };
}

/** Net P&L per calendar month ("YYYY-MM"), for the monthly returns grid. */
export function monthly(days: DayPnl[]) {
  const map = new Map<string, number>();
  for (const d of days) map.set(d.day.slice(0, 7), r2((map.get(d.day.slice(0, 7)) ?? 0) + d.net));
  return map;
}

/* ───────────────────────────── Psychology ───────────────────────────── */

const REVENGE_WINDOW_MS = 30 * 60_000;

/**
 * Behaviour patterns that usually signal tilt:
 * - revenge trades: opened within 30 minutes of closing a loser
 * - size-ups after a loss: that revenge trade is bigger than the losing one
 * - overtrading days: more than twice the median number of trades
 * - trades taken after two or more consecutive losses
 */
export function tiltPatterns(ts: ATrade[]) {
  const byOpen = [...ts].sort((a, b) => a.openAt - b.openAt);
  const byClose = [...ts].sort((a, b) => a.closeAt - b.closeAt);
  const revenge: ATrade[] = [];
  const sizedUp: ATrade[] = [];
  for (const t of byOpen) {
    const prevLoss = [...byClose].reverse().find((p) => p.id !== t.id && p.closeAt <= t.openAt);
    if (prevLoss && prevLoss.net < 0 && t.openAt - prevLoss.closeAt <= REVENGE_WINDOW_MS) {
      revenge.push(t);
      if (t.volume > prevLoss.volume * 1.2) sizedUp.push(t);
    }
  }

  const perDay = new Map<string, ATrade[]>();
  for (const t of ts) perDay.set(t.day, [...(perDay.get(t.day) ?? []), t]);
  const counts = [...perDay.values()].map((l) => l.length).sort((a, b) => a - b);
  const median = counts.length ? counts[Math.floor((counts.length - 1) / 2)] : 0;
  const overDays = [...perDay].filter(([, l]) => median > 0 && l.length > median * 2);

  const afterStreak: ATrade[] = [];
  let losses = 0;
  for (const t of byClose) {
    if (losses >= 2) afterStreak.push(t);
    losses = t.net < 0 ? losses + 1 : t.net > 0 ? 0 : losses;
  }

  return {
    revenge: summarize("Revenge trades", revenge),
    sizedUp: summarize("Bigger size after a loss", sizedUp),
    afterStreak: summarize("After 2+ losses in a row", afterStreak),
    overtrading: {
      medianTradesPerDay: median,
      days: overDays.length,
      ...summarize("Overtrading days", overDays.flatMap(([, l]) => l)),
    },
    baseline: summarize("All trades", ts),
  };
}

/** 0–100 from plan adherence, stop-loss usage and journaling consistency (each weighted). */
export function disciplineScore(ts: ATrade[], journaledTradingDays: number, tradingDays: number) {
  const recorded = ts.filter((t) => t.followedPlan != null);
  const plan = recorded.length ? recorded.filter((t) => t.followedPlan).length / recorded.length : null;
  const stops = ts.length ? ts.filter((t) => t.rMultiple != null).length / ts.length : null;
  const journal = tradingDays ? journaledTradingDays / tradingDays : null;
  const parts = [
    { key: "Followed plan", value: plan, weight: 0.4 },
    { key: "Used a stop loss", value: stops, weight: 0.3 },
    { key: "Journaled trading days", value: journal, weight: 0.3 },
  ];
  const usable = parts.filter((p) => p.value != null);
  const totalWeight = usable.reduce((s, p) => s + p.weight, 0);
  const score = totalWeight ? Math.round((usable.reduce((s, p) => s + p.value! * p.weight, 0) / totalWeight) * 100) : null;
  return { score, parts };
}
