/**
 * Data-driven trading psychology ("mindset coach"): turn the trader's own
 * history into baselines that make streaks, hold times and trading windows
 * feel normal instead of scary. Pure functions over closed trades.
 */
import type { ATrade } from "./analytics";

/* ─────────────────────────────── defaults ─────────────────────────────── */

/** Minutes after a losing trade during which a new trade counts as revenge. */
export const DEFAULT_COOLDOWN_MINUTES = 30;
/** A heatmap cell needs this many trades before it can be a "trade" or "avoid" zone. */
export const ZONE_MIN_TRADES = 5;
/** Trades (live + backtest) on a setup for full statistical confidence. */
export const CONFIDENCE_TRADES = 100;

const byClose = (ts: ATrade[]) => [...ts].sort((a, b) => a.closeAt - b.closeAt);

/* ─────────────────────────────── 2 & 5: streaks ─────────────────────────────── */

export type StreakCheck = {
  current: { kind: "win" | "loss" | "none"; count: number };
  maxWins: number;
  maxLosses: number;
  /** Win rate over decided trades (breakeven excluded), 0..1, or null. */
  winRate: number | null;
  decided: number;
  /** Expected losses out of every 10 trades at this win rate. */
  lossesPer10: number | null;
  /** About how many trades between runs of `current.count` losses (or wins) in a row. */
  runEvery: number | null;
};

export function streakCheck(ts: ATrade[]): StreakCheck {
  const sorted = byClose(ts);
  let w = 0;
  let l = 0;
  let maxWins = 0;
  let maxLosses = 0;
  let wins = 0;
  let losses = 0;
  for (const t of sorted) {
    if (t.net > 0) {
      wins++;
      w++;
      l = 0;
    } else if (t.net < 0) {
      losses++;
      l++;
      w = 0;
    }
    maxWins = Math.max(maxWins, w);
    maxLosses = Math.max(maxLosses, l);
  }
  const decided = wins + losses;
  const winRate = decided ? wins / decided : null;
  const current: StreakCheck["current"] = w > 0 ? { kind: "win", count: w } : l > 0 ? { kind: "loss", count: l } : { kind: "none", count: 0 };
  // A run of k results with probability p each starts roughly once every 1 / p^k trades.
  const p = winRate == null ? null : current.kind === "loss" ? 1 - winRate : winRate;
  const runEvery = p != null && p > 0 && p < 1 && current.count >= 2 ? Math.round(1 / p ** current.count) : null;
  return {
    current,
    maxWins,
    maxLosses,
    winRate,
    decided,
    lossesPer10: winRate == null ? null : Math.round((1 - winRate) * 10 * 10) / 10,
    runEvery,
  };
}

/* ─────────────────────────────── 4: hold times ─────────────────────────────── */

export type HoldTimes = {
  winners: number;
  losers: number;
  avgWinSec: number | null;
  avgLossSec: number | null;
  medianWinSec: number | null;
  medianLossSec: number | null;
  /** Share of winners closed in under half the average winner's time (cutting winners short). */
  earlyWinShare: number | null;
  /** Losers are held longer than winners on average (hoping they come back). */
  holdsLosersLonger: boolean;
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function holdTimes(ts: ATrade[]): HoldTimes {
  const dur = (t: ATrade) => t.durationSec ?? Math.max(0, Math.round((t.closeAt - t.openAt) / 1000));
  const win = ts.filter((t) => t.net > 0).map(dur);
  const loss = ts.filter((t) => t.net < 0).map(dur);
  const avgWinSec = avg(win);
  const avgLossSec = avg(loss);
  return {
    winners: win.length,
    losers: loss.length,
    avgWinSec: avgWinSec == null ? null : Math.round(avgWinSec),
    avgLossSec: avgLossSec == null ? null : Math.round(avgLossSec),
    medianWinSec: median(win),
    medianLossSec: median(loss),
    earlyWinShare: avgWinSec && win.length >= 5 ? win.filter((d) => d < avgWinSec / 2).length / win.length : null,
    holdsLosersLonger: avgWinSec != null && avgLossSec != null && win.length >= 5 && loss.length >= 5 && avgLossSec > avgWinSec * 1.2,
  };
}

/** "1h 17m", "52m", "40s". */
export function formatDuration(sec: number | null | undefined) {
  if (sec == null) return "—";
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/* ─────────────────────────────── 6: day × hour heatmap ─────────────────────────────── */

export type HeatCell = { weekday: number; hour: number; trades: number; wins: number; losses: number; net: number };
export type Zone = HeatCell & { expectancy: number; winRate: number };

export function heatmap(ts: ATrade[], minTrades = ZONE_MIN_TRADES) {
  const cells = new Map<string, HeatCell>();
  for (const t of ts) {
    const k = `${t.weekday}-${t.hour}`;
    const c = cells.get(k) ?? { weekday: t.weekday, hour: t.hour, trades: 0, wins: 0, losses: 0, net: 0 };
    c.trades++;
    if (t.net > 0) c.wins++;
    else if (t.net < 0) c.losses++;
    c.net = Math.round((c.net + t.net) * 100) / 100;
    cells.set(k, c);
  }
  const zone = (c: HeatCell): Zone => ({
    ...c,
    expectancy: c.net / c.trades,
    winRate: c.wins + c.losses ? c.wins / (c.wins + c.losses) : 0,
  });
  const eligible = [...cells.values()].filter((c) => c.trades >= minTrades).map(zone);
  const best = eligible.filter((c) => c.net > 0).sort((a, b) => b.expectancy - a.expectancy).slice(0, 3);
  const avoid = eligible.filter((c) => c.net < 0).sort((a, b) => a.expectancy - b.expectancy).slice(0, 3);
  const maxAbs = Math.max(0, ...[...cells.values()].map((c) => Math.abs(c.net)));
  return { cells, best, avoid, maxAbs };
}

/* ─────────────────────────────── 1: setup confidence ─────────────────────────────── */

export type SetupRep = { setupId: string; name: string; live: number; liveWins: number; liveNet: number; backtest: number; backtestWins: number };

export type SetupConfidence = SetupRep & {
  reps: number;
  winRate: number | null;
  expectancy: number | null;
  /** 0–100: 60 for practice (reps up to CONFIDENCE_TRADES) + 40 for a proven edge (positive expectancy, win rate). */
  score: number;
  level: "practice" | "building" | "confident";
  repsToGo: number;
};

export function setupConfidence(rows: SetupRep[], target = CONFIDENCE_TRADES): SetupConfidence[] {
  return rows
    .map((r) => {
      const reps = r.live + r.backtest;
      const wins = r.liveWins + r.backtestWins;
      const winRate = reps ? wins / reps : null;
      const expectancy = r.live ? r.liveNet / r.live : null;
      const practice = Math.min(reps, target) / target;
      // Edge: profitable live results, scaled by win rate above 40%. Backtests alone earn half.
      const edge =
        winRate == null
          ? 0
          : (expectancy == null ? 0.5 : expectancy > 0 ? 1 : 0) * Math.min(1, Math.max(0, (winRate - 0.4) / 0.25));
      const score = Math.round(practice * 60 + edge * 40);
      return {
        ...r,
        reps,
        winRate,
        expectancy,
        score,
        level: (score >= 70 ? "confident" : score >= 40 ? "building" : "practice") as SetupConfidence["level"],
        repsToGo: Math.max(0, target - reps),
      };
    })
    .sort((a, b) => b.score - a.score || b.reps - a.reps);
}

/* ─────────────────────────────── 3: checklist adherence ─────────────────────────────── */

export type ChecklistState = { done: number; total: number } | null;

export function checklistAdherence(ts: (ATrade & { checklist: ChecklistState })[]) {
  const group = (pick: (t: (typeof ts)[number]) => boolean) => {
    const g = ts.filter(pick);
    const wins = g.filter((t) => t.net > 0).length;
    const losses = g.filter((t) => t.net < 0).length;
    const net = g.reduce((s, t) => s + t.net, 0);
    return { trades: g.length, winRate: wins + losses ? wins / (wins + losses) : null, net, expectancy: g.length ? net / g.length : null };
  };
  const tracked = ts.filter((t) => t.checklist && t.checklist.total > 0);
  return {
    tracked: tracked.length,
    full: group((t) => Boolean(t.checklist && t.checklist.total > 0 && t.checklist.done === t.checklist.total)),
    partial: group((t) => Boolean(t.checklist && t.checklist.total > 0 && t.checklist.done < t.checklist.total)),
  };
}

/* ─────────────────────────────── 3: revenge / cooldown ─────────────────────────────── */

/** Trades opened within `minutes` after a losing trade closed (any account). */
export function revengeTrades(ts: ATrade[], minutes = DEFAULT_COOLDOWN_MINUTES) {
  const losses = ts.filter((t) => t.net < 0).map((t) => t.closeAt).sort((a, b) => a - b);
  const win = minutes * 60_000;
  return ts.filter((t) => losses.some((c) => t.openAt >= c && t.openAt - c <= win));
}
