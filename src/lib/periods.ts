import { addDays, addMonths, endOfMonth, formatDay, isDay, startOfMonth, startOfWeek, type WeekStart } from "./dates";

export const PERIODS = ["day", "week", "month", "year", "custom"] as const;
export type Period = (typeof PERIODS)[number];

export type ResolvedPeriod = {
  period: Period;
  from: string;
  to: string;
  label: string;
  prev: { from: string; to: string };
  prevAnchor: string;
  nextAnchor: string;
};

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Turn a report period + anchor day into a date range, its label and the previous range for comparison. */
export function resolvePeriod(
  period: Period,
  anchor: string,
  weekStartsOn: WeekStart,
  custom?: { from?: string; to?: string },
): ResolvedPeriod {
  switch (period) {
    case "day":
      return {
        period,
        from: anchor,
        to: anchor,
        label: formatDay(anchor, { weekday: "short", month: "long", day: "numeric", year: "numeric" }),
        prev: { from: addDays(anchor, -1), to: addDays(anchor, -1) },
        prevAnchor: addDays(anchor, -1),
        nextAnchor: addDays(anchor, 1),
      };
    case "week": {
      const from = startOfWeek(anchor, weekStartsOn);
      const to = addDays(from, 6);
      return {
        period,
        from,
        to,
        label: `${formatDay(from, { month: "short", day: "numeric" })} – ${formatDay(to, { month: "short", day: "numeric", year: "numeric" })}`,
        prev: { from: addDays(from, -7), to: addDays(to, -7) },
        prevAnchor: addDays(anchor, -7),
        nextAnchor: addDays(anchor, 7),
      };
    }
    case "year": {
      const y = anchor.slice(0, 4);
      return {
        period,
        from: `${y}-01-01`,
        to: `${y}-12-31`,
        label: y,
        prev: { from: `${+y - 1}-01-01`, to: `${+y - 1}-12-31` },
        prevAnchor: `${+y - 1}${anchor.slice(4)}`,
        nextAnchor: `${+y + 1}${anchor.slice(4)}`,
      };
    }
    case "custom": {
      let from = isDay(custom?.from) ? custom!.from! : startOfMonth(anchor);
      let to = isDay(custom?.to) ? custom!.to! : anchor;
      if (from > to) [from, to] = [to, from];
      const len = daysBetween(from, to) + 1;
      return {
        period,
        from,
        to,
        label: `${formatDay(from, { month: "short", day: "numeric", year: "numeric" })} – ${formatDay(to, { month: "short", day: "numeric", year: "numeric" })}`,
        prev: { from: addDays(from, -len), to: addDays(from, -1) },
        prevAnchor: anchor,
        nextAnchor: anchor,
      };
    }
    default: {
      const from = startOfMonth(anchor);
      const prevAnchor = addMonths(anchor, -1);
      return {
        period: "month",
        from,
        to: endOfMonth(anchor),
        label: formatDay(anchor, { month: "long", year: "numeric" }),
        prev: { from: startOfMonth(prevAnchor), to: endOfMonth(prevAnchor) },
        prevAnchor,
        nextAnchor: addMonths(anchor, 1),
      };
    }
  }
}
