import { addDays } from "./dates";

export const RANGES = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export function parseRange(v: unknown, fallback: RangeKey): RangeKey {
  return (RANGES.find((r) => r.key === v)?.key ?? fallback) as RangeKey;
}

/** First day (inclusive) of a range ending today, or undefined for all time. */
export function rangeStart(range: RangeKey, today: string) {
  switch (range) {
    case "7d":
      return addDays(today, -6);
    case "30d":
      return addDays(today, -29);
    case "90d":
      return addDays(today, -89);
    case "ytd":
      return `${today.slice(0, 4)}-01-01`;
    case "1y":
      return addDays(today, -364);
    default:
      return undefined;
  }
}
