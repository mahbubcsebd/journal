import { describe, expect, it } from "vitest";
import type { ATrade } from "./analytics";
import { allTimeBuckets, applyFilters, parseAnalyticsQuery, timeBucket, withMetric } from "./analytics-query";

const base = { hour: 9, weekday: 1, session: "LONDON", volume: 0.1, durationSec: 60, setup: null, emotionBefore: null, followedPlan: null, rating: null, accountName: "A", openAt: 0, closeAt: 1, day: "2026-11-02" };
const t = (o: Partial<ATrade>): ATrade => ({ id: "x", symbol: "XAUUSD", side: "LONG", net: 10, commission: -1, swap: -0.5, rMultiple: null, setupId: null, tags: [], ...base, ...o }) as ATrade;

describe("analytics query", () => {
  it("parses custom dates, filters and options", () => {
    const q = parseAnalyticsQuery({ from: "2026-10-01", to: "2026-10-31", symbol: "xauusd", side: "SHORT", metric: "r", interval: "30", by: "exit" });
    expect(q).toMatchObject({ from: "2026-10-01", to: "2026-10-31", metric: "r", interval: 30, by: "exit", filters: { symbol: "XAUUSD", side: "SHORT" } });
    expect(parseAnalyticsQuery({ from: "junk", interval: "7", metric: "x" })).toMatchObject({ from: undefined, interval: 60, metric: "net", range: "90d" });
  });
  it("filters and re-measures trades", () => {
    const ts = [t({ id: "a", rMultiple: 2 }), t({ id: "b", symbol: "EURUSD", side: "SHORT", tags: [{ name: "FOMO", kind: "MISTAKE" }] })];
    expect(applyFilters(ts, { side: "SHORT" }).map((x) => x.id)).toEqual(["b"]);
    expect(applyFilters(ts, { tag: "FOMO", symbol: "EURUSD" }).map((x) => x.id)).toEqual(["b"]);
    expect(withMetric(ts, "gross")[0].net).toBe(11.5);
    expect(withMetric(ts, "r").map((x) => x.net)).toEqual([2]);
  });
  it("buckets time of day", () => {
    expect(timeBucket(9.75, 30)).toBe("09:30");
    expect(timeBucket(9.75, 120)).toBe("08:00");
    expect(allTimeBuckets(120)).toHaveLength(12);
  });
});
