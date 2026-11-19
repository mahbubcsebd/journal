import { describe, expect, it } from "vitest";
import { preTradeCheck, riskAmount, type PreTradeContext } from "./pretrade";

const NOW = Date.parse("2026-11-19T10:00:00Z");
const base: PreTradeContext = {
  now: NOW,
  weekday: 4,
  hour: 16,
  balance: 10_000,
  currency: "USD",
  cooldownMinutes: 30,
  window: { before: 15, after: 15 },
  events: [],
  lastLoss: null,
  today: [],
  openSameSymbol: 0,
  avoidZones: [],
  bestZones: [],
  symbolStats: null,
  limits: [],
};
const gold = { symbol: "XAUUSD", side: "LONG" as const, entry: 4000, sl: 3990, tp: 4030, lots: 0.1 };
const by = (r: ReturnType<typeof preTradeCheck>, id: string) => r.checks.find((c) => c.id === id);

describe("riskAmount", () => {
  it("gold: $10 move × 0.1 lot × 100 oz = $100", () => expect(riskAmount(gold, "USD")).toBeCloseTo(100));
  it("EURUSD 20 pips at 0.5 lot = $100", () => expect(riskAmount({ symbol: "EURUSD", side: "LONG", entry: 1.1, sl: 1.098, lots: 0.5 }, "USD")).toBeCloseTo(100));
  it("USDJPY converts by price", () => expect(riskAmount({ symbol: "USDJPY", side: "SHORT", entry: 150, sl: 150.3, lots: 1 }, "USD")).toBeCloseTo(200));
  it("cent accounts are in cents", () => expect(riskAmount(gold, "USC")).toBeCloseTo(10_000));
  it("crosses without a rate are unknown", () => expect(riskAmount({ symbol: "EURJPY", side: "LONG", entry: 160, sl: 159, lots: 1 }, "USD")).toBeNull());
});

describe("preTradeCheck", () => {
  it("a clean, well-sized trade is a go", () => {
    const r = preTradeCheck(gold, base);
    expect(r.verdict).toBe("ok");
    expect(by(r, "rr")?.title).toBe("Reward:risk 3.00R");
    expect(by(r, "risk")?.level).toBe("ok");
  });
  it("no stop loss → stop", () => {
    const r = preTradeCheck({ ...gold, sl: null }, base);
    expect(r.verdict).toBe("stop");
    expect(r.checks[0].id).toBe("sl");
  });
  it("stop on the wrong side → stop", () => expect(by(preTradeCheck({ ...gold, sl: 4010 }, base), "sl")?.level).toBe("stop"));
  it("risk 1.5% caution, 3% stop", () => {
    expect(by(preTradeCheck({ ...gold, lots: 0.15 }, base), "risk")?.level).toBe("caution");
    expect(by(preTradeCheck({ ...gold, lots: 0.3 }, base), "risk")?.level).toBe("stop");
  });
  it("news in the window stops; news within 2h is a caution; other currencies are ignored", () => {
    const ev = (min: number, currency = "USD") => ({ id: "x", title: "CPI m/m", currency, impact: "High", time: NOW + min * 60_000 });
    expect(by(preTradeCheck(gold, { ...base, events: [ev(10)] }), "news")).toMatchObject({ level: "stop", title: "News window: USD CPI m/m (in 10 min)" });
    expect(by(preTradeCheck(gold, { ...base, events: [ev(-5)] }), "news")?.level).toBe("stop");
    expect(by(preTradeCheck(gold, { ...base, events: [ev(90)] }), "news")?.level).toBe("caution");
    expect(by(preTradeCheck(gold, { ...base, events: [ev(10, "JPY")] }), "news")?.level).toBe("ok");
  });
  it("cooldown after a recent loss", () => {
    const r = preTradeCheck(gold, { ...base, lastLoss: { symbol: "XAUUSD", net: -50, closedAt: NOW - 10 * 60_000 } });
    expect(by(r, "cooldown")).toMatchObject({ level: "stop" });
    expect(by(r, "cooldown")?.detail).toContain("20m");
    expect(by(preTradeCheck(gold, { ...base, lastLoss: { symbol: "XAUUSD", net: -50, closedAt: NOW - 40 * 60_000 } }), "cooldown")).toBeUndefined();
  });
  it("losing streak, overtrading, limits, zones, symbol record, stacking", () => {
    const r = preTradeCheck(gold, {
      ...base,
      today: [{ net: 5 }, { net: -1 }, { net: -2 }],
      limits: [{ label: "Max loss (daily)", status: "warning" }],
      avoidZones: [{ weekday: 4, hour: 16, trades: 8, net: -120 }],
      symbolStats: { trades: 40, net: -300, winRate: 0.4 },
      openSameSymbol: 1,
    });
    expect(r.verdict).toBe("caution");
    expect(r.checks.filter((c) => c.level === "caution").map((c) => c.id).sort()).toEqual(["limit-Max loss (daily)", "open", "streak", "symbol", "zone"]);
    expect(by(preTradeCheck(gold, { ...base, limits: [{ label: "Max trades", status: "breached" }] }), "limit-Max trades")?.level).toBe("stop");
    expect(by(preTradeCheck(gold, { ...base, today: [{ net: -1 }, { net: -1 }, { net: -1 }] }), "streak")?.level).toBe("stop");
  });
  it("speaks Bangla", () => {
    const r = preTradeCheck({ ...gold, sl: null }, base, "bn");
    expect(r.checks[0].title).toBe("স্টপ লস নেই");
  });
});
