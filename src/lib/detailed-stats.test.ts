import { describe, expect, it } from "vitest";
import type { ATrade } from "./analytics";
import { detailedStats, drawdownDepths } from "./detailed-stats";

let n = 0;
const t = (day: string, net: number, durationSec = 600): ATrade => ({
  id: String(++n),
  day,
  hour: 9,
  weekday: 1,
  symbol: "XAUUSD",
  side: "LONG",
  session: null,
  net,
  commission: -1,
  swap: 0,
  volume: 0.5,
  durationSec,
  rMultiple: net > 0 ? 2 : net < 0 ? -1 : 0,
  setup: null,
  setupId: null,
  tags: [],
  emotionBefore: null,
  followedPlan: null,
  rating: null,
  accountName: "A",
  openAt: n * 1000,
  closeAt: n * 1000 + durationSec * 1000,
});

describe("detailedStats", () => {
  const trades = [
    t("2026-11-02", 100, 4620),
    t("2026-11-02", -40, 3120),
    t("2026-11-03", 60, 4620),
    t("2026-11-04", -80, 3120),
    t("2026-11-05", -20, 3120),
    t("2026-11-06", 0, 60),
    t("2026-11-09", 50, 4620),
  ];
  const s = detailedStats(trades, { openTrades: 2, loggedDays: 3 });

  it("fills the trade-level column", () => {
    expect(s.trade).toMatchObject({
      totalPnl: 70,
      totalTrades: 7,
      winningTrades: 3,
      losingTrades: 3,
      breakevenTrades: 1,
      maxConsecutiveWins: 1,
      maxConsecutiveLosses: 2,
      totalCommission: -7,
      largestProfit: 100,
      largestLoss: -80,
      avgHoldWinning: 4620,
      avgHoldLosing: 3120,
      avgHoldBreakeven: 60,
      avgTradePnl: 10,
    });
    expect(s.trade.avgDailyVolume).toBe(0.58); // 3.5 lots over 6 days
  });

  it("fills the day-level column", () => {
    expect(s.day).toMatchObject({
      openTrades: 2,
      loggedDays: 3,
      tradingDays: 6,
      winningDays: 3,
      losingDays: 2,
      breakevenDays: 1,
      maxConsecutiveWinningDays: 2,
      maxConsecutiveLosingDays: 2,
      largestProfitableDay: 60,
      largestLosingDay: -80,
      avgWinningDayPnl: 56.67,
      avgLosingDayPnl: -50,
      maxDrawdown: -100,
    });
  });

  it("adds planned R, fees and drawdown % with a capital base", () => {
    const withR = trades.map((x, i) => ({ ...x, plannedR: i === 0 ? 2 : i === 1 ? 3 : null, fee: i === 0 ? -0.5 : 0 }));
    const d = detailedStats(withR, { capital: 1000 });
    expect(d.day.avgPlannedR).toBe(2.5);
    expect(d.trade.totalFees).toBe(-0.5);
    expect(d.trade.totalCommission).toBe(-6.5);
    // Peak 1120 (after Nov 3) → trough 1020 (Nov 5): −100 / 1120.
    expect(d.day.maxDrawdownPct).toBeCloseTo(-100 / 1120);
    expect(detailedStats(trades).day.maxDrawdownPct).toBeNull();
  });

  it("averages drawdown episodes", () => {
    expect(drawdownDepths([{ drawdown: 0 }, { drawdown: -10 }, { drawdown: -30 }, { drawdown: 0 }, { drawdown: -5 }])).toEqual([-30, -5]);
  });
});
