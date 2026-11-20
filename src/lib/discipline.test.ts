import { describe, expect, it } from "vitest";
import { disciplineSummary, scoreDays, scoreTrades, type DTrade } from "./discipline";

const T0 = Date.parse("2026-11-19T08:00:00Z");
const min = 60_000;
let i = 0;
const tr = (openMin: number, o: Partial<DTrade> = {}): DTrade => ({
  id: `t${i++}`,
  symbol: "XAUUSD",
  side: "LONG",
  day: "2026-11-19",
  openAt: T0 + openMin * min,
  closeAt: T0 + (openMin + 10) * min,
  net: 10,
  sl: 3990,
  ...o,
});
const ctx = { window: { before: 15, after: 15 }, events: [] };

describe("scoreTrades", () => {
  it("a planned trade scores 100 even when it loses", () => {
    expect(scoreTrades([tr(0, { net: -50 })], ctx)[0]).toMatchObject({ rules: [], score: 100 });
  });
  it("no stop loss and news window", () => {
    const v = scoreTrades([tr(0, { sl: null })], { ...ctx, events: [{ id: "e", title: "CPI", currency: "USD", impact: "High", time: new Date(T0 + 5 * min) }] });
    expect(v[0].rules).toEqual(["no_sl", "news"]);
    expect(v[0].score).toBe(50);
  });
  it("revenge: opened within the cooldown after a losing close", () => {
    const v = scoreTrades([tr(0, { net: -20 }), tr(15), tr(80)], { ...ctx, cooldownMinutes: 30 });
    expect(v.map((x) => x.rules)).toEqual([[], ["revenge"], []]);
  });
  it("over the daily trade limit and past the daily loss limit", () => {
    const v = scoreTrades([tr(0, { net: -60 }), tr(60, { net: -50 }), tr(120)], { ...ctx, maxTradesPerDay: 2, dailyMaxLoss: 100 });
    expect(v[2].rules).toEqual(["overtrade", "past_limit"]);
  });
  it("ignored a 'stop' pre-trade check for the same symbol and side within the hour", () => {
    const v = scoreTrades([tr(30), tr(40, { side: "SHORT" })], { ...ctx, stopChecks: [{ symbol: "XAUUSDm", side: "LONG", at: T0 + 10 * min }] });
    expect(v.map((x) => x.rules)).toEqual([["ignored_check"], []]);
  });
});

describe("days and summary", () => {
  it("averages per day and counts the streak of good days", () => {
    const v = scoreTrades(
      [tr(0, { day: "2026-11-17", sl: null }), tr(0, { day: "2026-11-18" }), tr(30, { day: "2026-11-19" }), tr(60, { day: "2026-11-19", sl: null })],
      ctx,
    );
    const days = scoreDays(v);
    expect(days.map((d) => [d.day, d.score])).toEqual([
      ["2026-11-17", 75],
      ["2026-11-18", 100],
      ["2026-11-19", 88],
    ]);
    const s = disciplineSummary(days);
    expect(s.score).toBe(Math.round((75 + 100 + 88 * 2) / 4));
    expect(s.rules).toEqual([["no_sl", 2]]);
    expect(s.streak).toBe(2);
    expect(s.clean).toBe(2);
  });
});
