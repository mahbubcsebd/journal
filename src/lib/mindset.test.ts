import { describe, expect, it } from "vitest";
import type { ATrade } from "./analytics";
import { checklistAdherence, formatDuration, heatmap, holdTimes, revengeTrades, setupConfidence, streakCheck } from "./mindset";

let clock = Date.UTC(2026, 10, 2, 8);
const t = (net: number, o: Partial<ATrade> = {}): ATrade => {
  clock += 3_600_000;
  return {
    id: Math.random().toString(36).slice(2),
    day: "2026-11-02",
    hour: 9,
    weekday: 2,
    symbol: "XAUUSD",
    side: "LONG",
    session: "LONDON",
    net,
    commission: 0,
    swap: 0,
    volume: 0.1,
    durationSec: 600,
    rMultiple: null,
    setup: null,
    setupId: null,
    tags: [],
    emotionBefore: null,
    followedPlan: null,
    rating: null,
    accountName: "A",
    openAt: clock - 600_000,
    closeAt: clock,
    ...o,
  };
};

describe("streakCheck", () => {
  it("finds the current run and the record runs", () => {
    const ts = [10, 10, 10, -5, -5, 0, 10, -5, -5, -5].map((n) => t(n));
    const s = streakCheck(ts);
    expect(s).toMatchObject({ maxWins: 3, maxLosses: 3, current: { kind: "loss", count: 3 }, decided: 9 });
    expect(s.winRate).toBeCloseTo(4 / 9);
    expect(s.lossesPer10).toBe(5.6);
    // 3 losses in a row at a 5/9 loss rate: about every 1 / (5/9)^3 ≈ 6 trades.
    expect(s.runEvery).toBe(6);
  });
  it("handles no trades", () => {
    expect(streakCheck([])).toMatchObject({ current: { kind: "none", count: 0 }, winRate: null, runEvery: null });
  });
});

describe("holdTimes", () => {
  it("compares winners and losers and spots cut winners", () => {
    const ts = [
      ...[3600, 3600, 3600, 3600, 600, 600].map((d) => t(10, { durationSec: d })),
      ...[7200, 7200, 7200, 7200, 7200].map((d) => t(-10, { durationSec: d })),
    ];
    const h = holdTimes(ts);
    expect(h.avgWinSec).toBe(2600);
    expect(h.avgLossSec).toBe(7200);
    expect(h.earlyWinShare).toBeCloseTo(2 / 6);
    expect(h.holdsLosersLonger).toBe(true);
    expect(formatDuration(4620)).toBe("1h 17m");
    expect(formatDuration(3120)).toBe("52m");
  });
});

describe("heatmap", () => {
  it("marks trade and avoid zones only with enough trades", () => {
    const ts = [
      ...Array.from({ length: 5 }, () => t(20, { weekday: 2, hour: 9 })),
      ...Array.from({ length: 6 }, () => t(-15, { weekday: 3, hour: 15 })),
      ...Array.from({ length: 2 }, () => t(-50, { weekday: 1, hour: 3 })),
    ];
    const h = heatmap(ts);
    expect(h.best.map((z) => `${z.weekday}-${z.hour}`)).toEqual(["2-9"]);
    expect(h.avoid.map((z) => `${z.weekday}-${z.hour}`)).toEqual(["3-15"]);
    expect(h.cells.get("1-3")?.net).toBe(-100);
  });
});

describe("setupConfidence", () => {
  it("rewards repetition and a proven edge", () => {
    const [a, c, b] = setupConfidence([
      { setupId: "a", name: "Breakout", live: 80, liveWins: 52, liveNet: 400, backtest: 40, backtestWins: 26 },
      { setupId: "b", name: "Reversal", live: 10, liveWins: 4, liveNet: -50, backtest: 0, backtestWins: 0 },
      { setupId: "c", name: "News", live: 0, liveWins: 0, liveNet: 0, backtest: 30, backtestWins: 20 },
    ]);
    expect(a).toMatchObject({ name: "Breakout", reps: 120, repsToGo: 0, level: "confident" });
    expect(a.score).toBe(100);
    expect(c.name).toBe("News");
    expect(c.score).toBe(Math.round(0.3 * 60 + 0.5 * 40)); // backtests only: half the edge
    expect(b).toMatchObject({ score: 6, level: "practice", repsToGo: 90 });
  });
});

describe("checklist and revenge", () => {
  it("compares fully-checked trades with partial ones", () => {
    const ts = [
      { ...t(10), checklist: { done: 3, total: 3 } },
      { ...t(10), checklist: { done: 3, total: 3 } },
      { ...t(-10), checklist: { done: 1, total: 3 } },
      { ...t(5), checklist: null },
    ];
    const c = checklistAdherence(ts);
    expect(c.tracked).toBe(3);
    expect(c.full).toMatchObject({ trades: 2, winRate: 1, net: 20 });
    expect(c.partial).toMatchObject({ trades: 1, winRate: 0 });
  });
  it("flags trades opened soon after a loss", () => {
    const loss = t(-10);
    const quick = t(5, { openAt: loss.closeAt + 10 * 60_000, closeAt: loss.closeAt + 20 * 60_000 });
    const later = t(5, { openAt: loss.closeAt + 45 * 60_000, closeAt: loss.closeAt + 50 * 60_000 });
    expect(revengeTrades([loss, quick, later], 30).map((x) => x.id)).toEqual([quick.id]);
  });
});
