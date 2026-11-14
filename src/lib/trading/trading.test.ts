import { describe, expect, it } from "vitest";
import { buildTradesFromDeals, type RawDeal } from "./build-trades";
import { computePips, computeRMultiple, deriveTrade, marketSession } from "./metrics";
import { normalizeSymbol, pipSize } from "./symbols";

describe("symbols", () => {
  it("strips Exness suffixes", () => {
    expect(normalizeSymbol("EURUSDm")).toBe("EURUSD");
    expect(normalizeSymbol("XAUUSDc")).toBe("XAUUSD");
    expect(normalizeSymbol("USTECm")).toBe("USTEC");
    expect(normalizeSymbol("BTCUSD")).toBe("BTCUSD");
  });
  it("knows pip sizes", () => {
    expect(pipSize("EURUSDm")).toBe(0.0001);
    expect(pipSize("USDJPY")).toBe(0.01);
    expect(pipSize("XAUUSD")).toBe(0.1);
    expect(pipSize("US30")).toBe(1);
  });
});

describe("metrics", () => {
  it("computes pips and R for longs and shorts", () => {
    expect(computePips("EURUSD", "SHORT", 1.085, 1.087)).toBe(-20);
    expect(computePips("XAUUSD", "LONG", 2650.5, 2660.5)).toBe(100);
    expect(computeRMultiple("LONG", 2650.5, 2660.5, 2645.5)).toBe(2);
    expect(computeRMultiple("SHORT", 1.085, 1.087, 1.087)).toBe(-1);
    expect(computeRMultiple("LONG", 100, 110, null)).toBeNull();
    // stop already moved into profit is not an initial risk
    expect(computeRMultiple("LONG", 100, 110, 105)).toBeNull();
  });
  it("assigns sessions by UTC open hour", () => {
    expect(marketSession(new Date("2026-11-10T02:00:00Z"))).toBe("ASIA");
    expect(marketSession(new Date("2026-11-10T08:00:00Z"))).toBe("LONDON");
    expect(marketSession(new Date("2026-11-10T13:00:00Z"))).toBe("LONDON_NY_OVERLAP");
    expect(marketSession(new Date("2026-11-10T18:00:00Z"))).toBe("NEW_YORK");
  });
  it("derives net P&L and duration", () => {
    const t = deriveTrade({
      positionId: "1", symbol: "XAUUSD", side: "LONG",
      openTime: new Date("2026-11-10T08:00:00Z"), closeTime: new Date("2026-11-10T09:30:00Z"),
      openPrice: 2650, closePrice: 2660, volume: 0.1, sl: null, tp: null,
      commission: -0.7, swap: -0.3, grossPnl: 100,
    });
    expect(t.netPnl).toBe(99);
    expect(t.durationSec).toBe(5400);
    expect(t.status).toBe("CLOSED");
  });
});

describe("buildTradesFromDeals", () => {
  const base = { symbol: "EURUSD", commission: -1, swap: 0, profit: 0 };
  const deal = (o: Partial<Omit<RawDeal, "time">> & { ticket: string; time: string }): RawDeal =>
    ({ ...base, positionId: "P1", type: "BUY", entry: "IN", volume: 1, price: 1.1, ...o, time: new Date(o.time) }) as RawDeal;

  it("merges scale-ins and partial closes into one position", () => {
    const trades = buildTradesFromDeals([
      deal({ ticket: "1", time: "2026-11-10T08:00:00Z", volume: 1, price: 1.1 }),
      deal({ ticket: "2", time: "2026-11-10T08:05:00Z", volume: 1, price: 1.2 }),
      deal({ ticket: "3", time: "2026-11-10T09:00:00Z", type: "SELL", entry: "OUT", volume: 1, price: 1.3, profit: 150 }),
      deal({ ticket: "4", time: "2026-11-10T10:00:00Z", type: "SELL", entry: "OUT", volume: 1, price: 1.25, profit: 100 }),
      { ticket: "5", positionId: null, symbol: null, type: "BALANCE", entry: null, volume: null, price: null, commission: 0, swap: 0, profit: 500, time: new Date() },
    ]);
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      side: "LONG", volume: 2, openPrice: 1.15, closePrice: 1.275, commission: -4, grossPnl: 250,
    });
    expect(trades[0].closeTime?.toISOString()).toBe("2026-11-10T10:00:00.000Z");
  });

  it("keeps a partially closed position open", () => {
    const [t] = buildTradesFromDeals([
      deal({ ticket: "1", time: "2026-11-10T08:00:00Z", volume: 2 }),
      deal({ ticket: "2", time: "2026-11-10T09:00:00Z", type: "SELL", entry: "OUT", volume: 1, price: 1.2 }),
    ]);
    expect(t.closeTime).toBeNull();
  });
});
