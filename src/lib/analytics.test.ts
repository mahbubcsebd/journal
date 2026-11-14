import { describe, expect, it } from "vitest";
import { durationBucket, groupBy, histogram, monthly, niceBin, performance, riskRatios, type ATrade } from "./analytics";

const t = (o: Partial<ATrade>): ATrade => ({
  id: Math.random().toString(),
  day: "2026-11-02",
  hour: 9,
  weekday: 1,
  symbol: "EURUSD",
  side: "LONG",
  session: "LONDON",
  net: 0,
  commission: 0,
  swap: 0,
  volume: 0.1,
  durationSec: 600,
  rMultiple: null,
  setup: null,
  tags: [],
  emotionBefore: null,
  followedPlan: null,
  rating: null,
  accountName: "A",
  ...o,
});

const trades = [
  t({ net: 100, rMultiple: 2, durationSec: 3000, tags: [{ name: "A+", kind: "TAG" }] }),
  t({ net: -50, rMultiple: -1, symbol: "XAUUSD", tags: [{ name: "FOMO", kind: "MISTAKE" }] }),
  t({ net: -50, rMultiple: -1, side: "SHORT", tags: [{ name: "FOMO", kind: "MISTAKE" }, { name: "A+", kind: "TAG" }] }),
  t({ net: 200, rMultiple: 3, durationSec: 7200 }),
];

describe("analytics", () => {
  it("computes performance", () => {
    const p = performance(trades);
    expect(p).toMatchObject({ net: 200, trades: 4, wins: 2, losses: 2, grossProfit: 300, grossLoss: -100, expectancy: 50, avgR: 0.75 });
    expect(p.profitFactor).toBe(3);
    expect(p.payoff).toBe(3);
    expect(p.largestWin).toBe(200);
    expect(p.avgHoldWin).toBe(5100);
    expect(p).toMatchObject({ maxWins: 1, maxLosses: 2 });
  });
  it("groups, including multi-key groups and fixed orders", () => {
    const bySymbol = groupBy(trades, (x) => x.symbol);
    expect(bySymbol.map((r) => [r.key, r.net])).toEqual([["EURUSD", 250], ["XAUUSD", -50]]);
    const byTag = groupBy(trades, (x) => x.tags.map((g) => g.name));
    expect(byTag.find((r) => r.key === "FOMO")?.net).toBe(-100);
    expect(byTag.find((r) => r.key === "A+")?.trades).toBe(2);
    const bySide = groupBy(trades, (x) => x.side, ["LONG", "SHORT", "X"]);
    expect(bySide.map((r) => r.trades)).toEqual([3, 1, 0]);
  });
  it("buckets and histograms", () => {
    expect(durationBucket(30)).toBe("< 5m");
    expect(durationBucket(4000)).toBe("1–4h");
    const h = histogram([-1, -0.5, 0.2, 2, 2.4], 1);
    expect(h.map((b) => [b.from, b.count])).toEqual([[-1, 2], [0, 1], [1, 0], [2, 2]]);
    expect(niceBin([0, 100], 10)).toBe(10);
  });
  it("risk ratios and monthly totals", () => {
    const days = [{ day: "2026-10-30", net: 100 }, { day: "2026-11-02", net: -50 }, { day: "2026-11-03", net: 150 }];
    const r = riskRatios(days, -50);
    expect(r.recoveryFactor).toBe(4);
    expect(r.sharpe).toBeGreaterThan(0);
    expect(r.sortino).toBeGreaterThan(r.sharpe!);
    expect(Object.fromEntries(monthly(days))).toEqual({ "2026-10": 100, "2026-11": 100 });
  });
});
