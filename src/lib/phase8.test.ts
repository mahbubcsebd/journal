import { describe, expect, it } from "vitest";
import { evaluateChallenge } from "./challenge";
import { evaluateGoal, periodRange, previousPeriods } from "./goals";
import { losingStreakProbability, pipValuePerLot, positionSize, recoveryNeeded, riskReward } from "./risk";

const d = (day: string, net: number, trades = 1) => ({ day, net, trades, wins: net > 0 ? trades : 0, losses: net < 0 ? trades : 0 });

describe("goals", () => {
  it("builds period ranges", () => {
    expect(periodRange("WEEK", "2026-11-14", 1)).toMatchObject({ from: "2026-11-09", to: "2026-11-15" });
    expect(previousPeriods("MONTH", "2026-03-31", 1, 2).map((p) => p.from)).toEqual(["2026-02-01", "2026-01-01"]);
  });
  it("evaluates targets and limits", () => {
    expect(evaluateGoal("NET_PNL", 100, [d("a", 60), d("b", 50)]).status).toBe("hit");
    expect(evaluateGoal("NET_PNL", 100, [d("a", 60)]).status).toBe("in_progress");
    expect(evaluateGoal("NET_PNL", 100, [d("a", 60)], true).status).toBe("missed");
    expect(evaluateGoal("MAX_LOSS", 100, [d("a", -85)]).status).toBe("warning");
    expect(evaluateGoal("MAX_LOSS", 100, [d("a", -100)]).status).toBe("breached");
    expect(evaluateGoal("MAX_TRADES", 3, [d("a", 10, 4)]).status).toBe("breached");
    expect(evaluateGoal("WIN_RATE", 50, [d("a", 10, 1), d("b", -5, 1)]).value).toBe(50);
    expect(evaluateGoal("GREEN_DAYS", 2, [d("a", 10), d("b", -5), d("c", 3)]).status).toBe("hit");
  });
});

describe("risk tools", () => {
  it("knows pip values per lot", () => {
    expect(pipValuePerLot({ symbol: "EURUSD" })).toBe(10);
    expect(pipValuePerLot({ symbol: "XAUUSDm" })).toBe(10);
    expect(pipValuePerLot({ symbol: "USDJPY", price: 150 })).toBeCloseTo(6.667, 3);
    expect(pipValuePerLot({ symbol: "EURGBP" })).toBeNull();
    expect(pipValuePerLot({ symbol: "EURGBP", quoteToUsd: 1.27 })).toBeCloseTo(12.7);
  });
  it("sizes positions and rounds down to the lot step", () => {
    expect(positionSize({ riskAmount: 100, stopPips: 25, pipValue: 10 })).toEqual({ lots: 0.4, rawLots: 0.4, actualRisk: 100 });
    expect(positionSize({ riskAmount: 50, stopPips: 30, pipValue: 10 })?.lots).toBe(0.16);
    expect(positionSize({ riskAmount: 50, stopPips: 0, pipValue: 10 })).toBeNull();
  });
  it("computes risk:reward and validates sides", () => {
    const r = riskReward({ side: "LONG", entry: 2650, sl: 2645, tp: 2665, symbol: "XAUUSD" });
    expect(r).toMatchObject({ slPips: 50, tpPips: 150, rr: 3, breakevenWinRate: 0.25 });
    expect(riskReward({ side: "SHORT", entry: 1.1, sl: 1.09, symbol: "EURUSD" })).toHaveProperty("error");
  });
  it("recovery and losing streak odds", () => {
    expect(recoveryNeeded(0.5)).toBe(1);
    expect(losingStreakProbability(0.5, 1, 1)).toBeCloseTo(0.5);
    expect(losingStreakProbability(0.5, 2, 3)).toBeCloseTo(0.375); // LL?, WLL
    // Cross-checked with a Monte Carlo run (~0.46).
    expect(losingStreakProbability(0.6, 5, 100)).toBeCloseTo(0.459, 2);
  });
});

describe("challenge", () => {
  const cfg = { startBalance: 10_000, profitTarget: 1_000, maxDrawdown: 1_000, maxDailyDrawdown: 500, minTradingDays: 3, trailingDrawdown: false, startDate: "2026-11-01", endDate: null };
  it("passes once target and minimum days are met", () => {
    const r = evaluateChallenge(
      cfg,
      [{ day: "2026-11-02", net: 900 }, { day: "2026-11-03", net: 200 }, { day: "2026-11-04", net: 10 }, { day: "2026-11-05", net: -700 }],
      "2026-11-06",
    );
    // Passed on the 3rd trading day; the later losing day is ignored.
    expect(r).toMatchObject({ status: "PASSED", passedOn: "2026-11-04", profit: 1110, tradingDays: 3 });
  });
  it("fails on the daily loss limit or the drawdown floor", () => {
    expect(evaluateChallenge(cfg, [{ day: "2026-11-02", net: -600 }], "2026-11-05")).toMatchObject({ status: "FAILED", failReason: "Daily loss limit" });
    const r = evaluateChallenge(cfg, [{ day: "2026-11-02", net: -400 }, { day: "2026-11-03", net: -400 }, { day: "2026-11-04", net: -300 }], "2026-11-05");
    expect(r).toMatchObject({ status: "FAILED", failReason: "Max drawdown", failedOn: "2026-11-04" });
  });
  it("trails the floor up to the starting balance", () => {
    const r = evaluateChallenge({ ...cfg, trailingDrawdown: true, maxDailyDrawdown: null }, [{ day: "2026-11-02", net: 800 }, { day: "2026-11-03", net: 400 }], "2026-11-05");
    expect(r.floor).toBe(10_000);
    expect(r.status).toBe("ACTIVE");
  });
});
