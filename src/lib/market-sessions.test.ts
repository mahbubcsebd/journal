import { describe, expect, it } from "vitest";
import { activeOverlaps, clockSummary, forexWeek, localMidnight, sessionStatus, timeline, tzOffset, zonedTime } from "./market-sessions";

const at = (iso: string) => Date.parse(iso);
const open = (now: number) => sessionStatus(now).filter((s) => s.isOpen).map((s) => s.key);

describe("time zones", () => {
  it("offsets and wall-clock times", () => {
    expect(tzOffset(at("2026-11-19T00:00:00Z"), "Asia/Dhaka")).toBe(6 * 3_600_000);
    expect(zonedTime(2026, 11, 19, 8, "America/New_York")).toBe(at("2026-11-19T13:00:00Z"));
    expect(zonedTime(2026, 7, 15, 8, "America/New_York")).toBe(at("2026-07-15T12:00:00Z"));
    expect(localMidnight(at("2026-11-19T20:00:00Z"), "Asia/Dhaka")).toBe(at("2026-11-19T18:00:00Z"));
  });
});

describe("sessions", () => {
  it("Thursday 13:30 UTC in November: London and New York, overlapping", () => {
    const now = at("2026-11-19T13:30:00Z");
    expect(open(now)).toEqual(["LONDON", "NEW_YORK"]);
    const s = sessionStatus(now);
    const london = s.find((x) => x.key === "LONDON")!;
    expect(london.end).toBe(at("2026-11-19T17:00:00Z"));
    expect(london.msToChange).toBe(3.5 * 3_600_000);
    expect(activeOverlaps(s).map((o) => o.name)).toEqual(["London–New York"]);
    // Tokyo next opens 09:00 JST Friday = 00:00 UTC.
    expect(s.find((x) => x.key === "TOKYO")!.start).toBe(at("2026-11-20T00:00:00Z"));
  });
  it("summer time moves London an hour earlier in UTC", () => {
    expect(open(at("2026-07-15T07:30:00Z"))).toContain("LONDON");
    expect(open(at("2026-11-19T07:30:00Z"))).not.toContain("LONDON");
  });
  it("Asia: Sydney and Tokyo together around 01:00 UTC", () => {
    expect(open(at("2026-11-19T01:00:00Z"))).toEqual(["SYDNEY", "TOKYO"]);
  });
  it("weekend: everything closed, Sydney reopens at the Sunday New York open", () => {
    const sat = at("2026-11-21T12:00:00Z");
    expect(open(sat)).toEqual([]);
    const sum = clockSummary(sat);
    expect(sum.weekOpen).toBe(false);
    // Sunday 17:00 New York (EST) = 22:00 UTC.
    expect(sum.weekReopens).toBe(at("2026-11-22T22:00:00Z"));
    expect(sum.nextOpen.key).toBe("SYDNEY");
    expect(sum.nextOpen.start).toBe(at("2026-11-22T22:00:00Z"));
  });
  it("Friday: New York closes at the weekly close", () => {
    const fri = at("2026-11-20T20:00:00Z");
    expect(open(fri)).toEqual(["NEW_YORK"]);
    expect(sessionStatus(fri).find((s) => s.key === "NEW_YORK")!.end).toBe(at("2026-11-20T22:00:00Z"));
    expect(forexWeek(at("2026-11-20T22:30:00Z")).open).toBe(false);
  });
  it("timeline bars stay inside the day", () => {
    const day = localMidnight(at("2026-11-19T10:00:00Z"), "Asia/Dhaka");
    const t = timeline(day);
    const ny = t.find((x) => x.key === "NEW_YORK")!;
    // NY 13:00–22:00 UTC = 19:00–04:00 Dhaka: two bars (early morning tail and evening).
    expect(ny.bars.length).toBe(2);
    for (const r of t) for (const b of r.bars) expect(b.from >= 0 && b.to <= 1 && b.from < b.to).toBe(true);
  });
});
