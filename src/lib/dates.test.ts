import { describe, expect, it } from "vitest";
import { addDays, addMonths, endOfMonth, monthGrid, startOfWeek, weekdayLabels } from "./dates";

describe("dates", () => {
  it("does day arithmetic across months and leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(endOfMonth("2026-11-14")).toBe("2026-11-30");
  });
  it("finds the start of the week", () => {
    expect(startOfWeek("2026-11-14", 1)).toBe("2026-11-09"); // Sat → Monday
    expect(startOfWeek("2026-11-14", 0)).toBe("2026-11-08"); // → Sunday
    expect(startOfWeek("2026-11-14", 6)).toBe("2026-11-14"); // Saturday start
  });
  it("builds a full month grid", () => {
    const g = monthGrid("2026-11-14", 1);
    expect(g[0][0]).toBe("2026-10-26");
    expect(g.at(-1)!.at(-1)).toBe("2026-12-06");
    expect(g.flat()).toContain("2026-11-30");
    expect(weekdayLabels(1)[0]).toBe("Mon");
    expect(weekdayLabels(0)[0]).toBe("Sun");
  });
});
