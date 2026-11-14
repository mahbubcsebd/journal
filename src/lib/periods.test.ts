import { describe, expect, it } from "vitest";
import { resolvePeriod } from "./periods";

describe("resolvePeriod", () => {
  it("handles weeks and months with a previous range", () => {
    expect(resolvePeriod("week", "2026-11-14", 1)).toMatchObject({ from: "2026-11-09", to: "2026-11-15", prev: { from: "2026-11-02", to: "2026-11-08" } });
    expect(resolvePeriod("month", "2026-03-31", 1)).toMatchObject({ from: "2026-03-01", to: "2026-03-31", prev: { from: "2026-02-01", to: "2026-02-28" } });
  });
  it("compares a custom range to the same length before it", () => {
    expect(resolvePeriod("custom", "2026-11-14", 1, { from: "2026-11-10", to: "2026-11-01" })).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-10",
      prev: { from: "2026-10-22", to: "2026-10-31" },
    });
  });
});
