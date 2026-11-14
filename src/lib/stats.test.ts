import { describe, expect, it } from "vitest";
import { dayStreaks, equityCurve, maxDrawdown, summarizeDays } from "./stats";

const d = (day: string, net: number, trades = 1) => ({ day, net, trades, wins: net > 0 ? trades : 0, losses: net < 0 ? trades : 0 });
const days = [d("2026-11-02", 100), d("2026-11-03", -50), d("2026-11-04", -80), d("2026-11-05", 200), d("2026-11-06", 30)];

describe("stats", () => {
  it("builds an equity curve with drawdown from the running peak", () => {
    const c = equityCurve(days);
    expect(c.map((p) => p.equity)).toEqual([100, 50, -30, 170, 200]);
    expect(c.map((p) => p.drawdown)).toEqual([0, -50, -130, 0, 0]);
    expect(maxDrawdown(c)).toBe(-130);
  });
  it("counts streaks", () => {
    expect(dayStreaks(days)).toEqual({ current: 2, longestGreen: 2, longestRed: 2 });
    expect(dayStreaks([d("a", -1), d("b", -2)]).current).toBe(-2);
  });
  it("summarizes days", () => {
    const s = summarizeDays(days);
    expect(s).toMatchObject({ net: 200, tradingDays: 5, greenDays: 3, redDays: 2, avgDay: 40 });
    expect(s.best?.day).toBe("2026-11-05");
    expect(s.worst?.day).toBe("2026-11-04");
  });
});
