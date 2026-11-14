import { describe, expect, it } from "vitest";
import { buildTradesFromDeals } from "../trading/build-trades";
import { eaPayloadSchema, fromEaDeal, fromEaPosition, fromMetaApiDeal, fromMetaApiPosition } from "./map";

describe("MetaApi mapping", () => {
  it("maps deals and builds a closed position", () => {
    const deals = [
      { id: "1", type: "DEAL_TYPE_BALANCE", time: "2026-11-01T00:00:00Z", profit: 1000 },
      { id: "2", type: "DEAL_TYPE_BUY", entryType: "DEAL_ENTRY_IN", symbol: "XAUUSDm", time: "2026-11-10T08:00:00Z", volume: 0.1, price: 2650, commission: -0.35, profit: 0, positionId: "77", stopLoss: 2645 },
      { id: "3", type: "DEAL_TYPE_SELL", entryType: "DEAL_ENTRY_OUT", symbol: "XAUUSDm", time: "2026-11-10T09:00:00Z", volume: 0.1, price: 2660, commission: -0.35, profit: 100, positionId: "77" },
    ].map(fromMetaApiDeal);
    expect(deals[0]).toMatchObject({ type: "BALANCE", positionId: null, profit: 1000 });
    const [t] = buildTradesFromDeals(deals.filter((d) => d !== null));
    expect(t).toMatchObject({ positionId: "77", symbol: "XAUUSD", side: "LONG", sl: 2645, grossPnl: 100, commission: -0.7 });
  });
  it("maps open positions with floating profit", () => {
    expect(fromMetaApiPosition({ id: 9, type: "POSITION_TYPE_SELL", symbol: "EURUSDm", time: "2026-11-14T10:00:00Z", openPrice: 1.1, currentPrice: 1.09, volume: 1, unrealizedProfit: 1000, profit: 990 })).toMatchObject({
      ticket: "9",
      side: "SHORT",
      symbol: "EURUSD",
      profit: 1000,
    });
  });
});

describe("EA payload", () => {
  const payload = {
    version: 1,
    login: 81234567,
    server: "Exness-MT5Real8",
    currency: "USD",
    balance: 1099.3,
    equity: 1120,
    leverage: 2000,
    deals: [
      { ticket: 9001, order: 5001, position: 1001, symbol: "XAUUSDm", type: 0, entry: 0, volume: 0.1, price: 2650.5, sl: 2645.5, tp: 0, commission: -0.35, swap: 0, fee: 0, profit: 0, time: 1793866503 },
      { ticket: 9000, position: 0, symbol: "", type: 2, entry: 0, volume: 0, price: 0, profit: 1000, time: 1793500000 },
    ],
    positions: [{ ticket: 1001, symbol: "XAUUSDm", type: 0, volume: 0.1, price_open: 2650.5, price_current: 2655, profit: 45, time: 1793866503 }],
  };
  it("validates and maps deals, balance operations and positions", () => {
    const p = eaPayloadSchema.parse(payload);
    expect(p.login).toBe("81234567");
    const [buy, bal] = p.deals.map(fromEaDeal);
    expect(buy).toMatchObject({ ticket: "9001", positionId: "1001", type: "BUY", entry: "IN", symbol: "XAUUSD", sl: 2645.5, tp: null });
    expect(buy.time.toISOString()).toBe("2026-11-05T08:15:03.000Z");
    expect(bal).toMatchObject({ type: "BALANCE", positionId: null });
    expect(fromEaPosition(p.positions[0])).toMatchObject({ side: "LONG", profit: 45 });
  });
  it("rejects malformed payloads", () => {
    expect(eaPayloadSchema.safeParse({ ...payload, login: "abc" }).success).toBe(false);
    expect(eaPayloadSchema.safeParse({ ...payload, deals: [{ ticket: 1 }] }).success).toBe(false);
  });
});
