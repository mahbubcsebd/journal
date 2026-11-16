/**
 * The full statistics sheet (trade-level and day-level), from closed trades
 * already in one reporting currency.
 */
import { performance, type ATrade } from "./analytics";
import { dayStreaks, equityCurve, maxDrawdown, type DailyPoint } from "./stats";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function dailyFromTrades(trades: ATrade[]): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (const t of trades) {
    const d = map.get(t.day) ?? { day: t.day, net: 0, trades: 0, wins: 0, losses: 0 };
    d.net = r2(d.net + t.net);
    d.trades++;
    if (t.net > 0) d.wins++;
    if (t.net < 0) d.losses++;
    map.set(t.day, d);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Depth of each drawdown (peak → recovery), as negative numbers. */
export function drawdownDepths(curve: { drawdown: number }[]) {
  const depths: number[] = [];
  let depth = 0;
  for (const p of curve) {
    if (p.drawdown < 0) depth = Math.min(depth, p.drawdown);
    else if (depth < 0) {
      depths.push(depth);
      depth = 0;
    }
  }
  if (depth < 0) depths.push(depth);
  return depths;
}

export function detailedStats(trades: ATrade[], extra: { openTrades?: number; loggedDays?: number } = {}) {
  const p = performance(trades);
  const days = dailyFromTrades(trades);
  const curve = equityCurve(days);
  const green = days.filter((d) => d.net > 0);
  const red = days.filter((d) => d.net < 0);
  const dur = (t: ATrade) => t.durationSec ?? Math.max(0, Math.round((t.closeAt - t.openAt) / 1000));
  const holdOf = (ts: ATrade[]) => {
    const m = mean(ts.map(dur));
    return m == null ? null : Math.round(m);
  };
  const breakeven = trades.filter((t) => t.net === 0);
  const rs = trades.map((t) => t.rMultiple).filter((r): r is number => r != null);
  const streaks = dayStreaks(days);
  const depths = drawdownDepths(curve);

  return {
    trade: {
      totalPnl: p.net,
      avgDailyVolume: days.length ? r2(p.lots / days.length) : null,
      avgWinningTrade: p.avgWin,
      avgLosingTrade: p.avgLoss,
      totalTrades: trades.length,
      winningTrades: p.wins,
      losingTrades: p.losses,
      breakevenTrades: breakeven.length,
      maxConsecutiveWins: p.maxWins,
      maxConsecutiveLosses: p.maxLosses,
      totalCommission: p.commission,
      totalSwap: p.swap,
      largestProfit: p.largestWin,
      largestLoss: p.largestLoss,
      avgHoldAll: holdOf(trades),
      avgHoldWinning: holdOf(trades.filter((t) => t.net > 0)),
      avgHoldLosing: holdOf(trades.filter((t) => t.net < 0)),
      avgHoldBreakeven: holdOf(breakeven),
      avgTradePnl: trades.length ? r2(p.net / trades.length) : null,
      profitFactor: p.profitFactor,
    },
    day: {
      openTrades: extra.openTrades ?? null,
      tradingDays: days.length,
      winningDays: green.length,
      losingDays: red.length,
      breakevenDays: days.length - green.length - red.length,
      loggedDays: extra.loggedDays ?? null,
      maxConsecutiveWinningDays: streaks.longestGreen,
      maxConsecutiveLosingDays: streaks.longestRed,
      avgDailyPnl: days.length ? r2(p.net / days.length) : null,
      avgWinningDayPnl: green.length ? r2(green.reduce((s, d) => s + d.net, 0) / green.length) : null,
      avgLosingDayPnl: red.length ? r2(red.reduce((s, d) => s + d.net, 0) / red.length) : null,
      largestProfitableDay: green.length ? Math.max(...green.map((d) => d.net)) : null,
      largestLosingDay: red.length ? Math.min(...red.map((d) => d.net)) : null,
      avgRealizedR: rs.length ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 100) / 100 : null,
      expectancy: p.expectancy,
      maxDrawdown: maxDrawdown(curve),
      avgDrawdown: depths.length ? r2(depths.reduce((a, b) => a + b, 0) / depths.length) : null,
    },
  };
}
