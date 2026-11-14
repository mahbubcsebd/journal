/** Pure statistics over a daily P&L series (already in one reporting currency). */
export type DailyPoint = {
  day: string;
  net: number;
  trades: number;
  wins: number;
  losses: number;
  grossProfit?: number;
  grossLoss?: number;
};

export type EquityPoint = { day: string; net: number; equity: number; drawdown: number };

export function equityCurve(days: DailyPoint[], start = 0): EquityPoint[] {
  let equity = start;
  let peak = start;
  return days.map((d) => {
    equity = round2(equity + d.net);
    peak = Math.max(peak, equity);
    return { day: d.day, net: d.net, equity, drawdown: round2(equity - peak) };
  });
}

export function maxDrawdown(curve: EquityPoint[]) {
  return curve.reduce((m, p) => Math.min(m, p.drawdown), 0);
}

/** Current and longest runs of green / red days. */
export function dayStreaks(days: DailyPoint[]) {
  let current = 0; // >0 green run, <0 red run
  let bestWin = 0;
  let worstLoss = 0;
  for (const d of days) {
    if (d.net > 0) current = current > 0 ? current + 1 : 1;
    else if (d.net < 0) current = current < 0 ? current - 1 : -1;
    else continue;
    bestWin = Math.max(bestWin, current);
    worstLoss = Math.min(worstLoss, current);
  }
  return { current, longestGreen: bestWin, longestRed: -worstLoss };
}

export function summarizeDays(days: DailyPoint[]) {
  const traded = days.filter((d) => d.trades > 0);
  const net = round2(traded.reduce((s, d) => s + d.net, 0));
  const trades = traded.reduce((s, d) => s + d.trades, 0);
  const wins = traded.reduce((s, d) => s + d.wins, 0);
  const losses = traded.reduce((s, d) => s + d.losses, 0);
  const green = traded.filter((d) => d.net > 0);
  const red = traded.filter((d) => d.net < 0);
  const best = traded.reduce<DailyPoint | null>((b, d) => (!b || d.net > b.net ? d : b), null);
  const worst = traded.reduce<DailyPoint | null>((w, d) => (!w || d.net < w.net ? d : w), null);
  return {
    net,
    trades,
    wins,
    losses,
    tradingDays: traded.length,
    greenDays: green.length,
    redDays: red.length,
    winRate: wins + losses ? wins / (wins + losses) : null,
    avgDay: traded.length ? round2(net / traded.length) : null,
    avgGreenDay: green.length ? round2(green.reduce((s, d) => s + d.net, 0) / green.length) : null,
    avgRedDay: red.length ? round2(red.reduce((s, d) => s + d.net, 0) / red.length) : null,
    grossProfit: round2(traded.reduce((s, d) => s + (d.grossProfit ?? 0), 0)),
    grossLoss: round2(traded.reduce((s, d) => s + (d.grossLoss ?? 0), 0)),
    best: best && best.net > 0 ? best : null,
    worst: worst && worst.net < 0 ? worst : null,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
