export type ChallengeConfig = {
  startBalance: number;
  profitTarget: number;
  maxDrawdown: number;
  maxDailyDrawdown: number | null;
  minTradingDays: number | null;
  trailingDrawdown: boolean;
  startDate: string;
  endDate: string | null;
};

export type ChallengeStatus = "ACTIVE" | "PASSED" | "FAILED" | "EXPIRED";

/**
 * Track a prop-firm style challenge from daily closed P&L. Drawdown limits are
 * checked at day close (intraday equity isn't known from closed trades).
 * A trailing floor follows the highest closing balance but never rises above
 * the starting balance. Evaluation stops on the day the challenge is passed or failed.
 */
export function evaluateChallenge(cfg: ChallengeConfig, days: { day: string; net: number }[], today: string) {
  let balance = cfg.startBalance;
  let peak = cfg.startBalance;
  let failedOn: string | null = null;
  let failReason: string | null = null;
  let passedOn: string | null = null;
  let tradingDays = 0;
  let worstDay: { day: string; net: number } | null = null;
  const floorAt = (pk: number) =>
    cfg.trailingDrawdown ? Math.min(cfg.startBalance, pk - cfg.maxDrawdown) : cfg.startBalance - cfg.maxDrawdown;

  const curve = [{ day: cfg.startDate, balance, floor: floorAt(peak), target: cfg.startBalance + cfg.profitTarget }];
  for (const d of days) {
    if (d.day < cfg.startDate || (cfg.endDate && d.day > cfg.endDate)) continue;
    // A phase ends the day it is passed or failed; later days don't count.
    if (failedOn || passedOn) break;
    tradingDays++;
    balance = Math.round((balance + d.net) * 100) / 100;
    if (!worstDay || d.net < worstDay.net) worstDay = d;
    const floor = floorAt(peak);
    if (cfg.maxDailyDrawdown != null && -d.net >= cfg.maxDailyDrawdown) {
      failedOn = d.day;
      failReason = "Daily loss limit";
    } else if (balance <= floor) {
      failedOn = d.day;
      failReason = "Max drawdown";
    }
    peak = Math.max(peak, balance);
    curve.push({ day: d.day, balance, floor: floorAt(peak), target: cfg.startBalance + cfg.profitTarget });
    if (!failedOn && !passedOn && balance - cfg.startBalance >= cfg.profitTarget && tradingDays >= (cfg.minTradingDays ?? 0)) {
      passedOn = d.day;
    }
  }

  const profit = Math.round((balance - cfg.startBalance) * 100) / 100;
  const floor = floorAt(peak);
  const status: ChallengeStatus = failedOn
    ? "FAILED"
    : passedOn
      ? "PASSED"
      : cfg.endDate && today > cfg.endDate
        ? "EXPIRED"
        : "ACTIVE";

  return {
    status,
    balance,
    profit,
    progress: cfg.profitTarget ? Math.max(0, profit / cfg.profitTarget) : 0,
    floor,
    roomToFloor: Math.round((balance - floor) * 100) / 100,
    tradingDays,
    daysNeeded: Math.max(0, (cfg.minTradingDays ?? 0) - tradingDays),
    worstDay,
    failedOn,
    failReason,
    passedOn,
    curve,
  };
}
