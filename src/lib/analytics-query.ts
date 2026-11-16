/**
 * Analytics page state, all in the URL so links keep every choice:
 * tab, preset range or custom dates, filters, P&L measure, time grouping.
 */
import type { ATrade } from "./analytics";
import { parseRange, type RangeKey } from "./ranges";

export const METRICS = [
  { key: "net", label: "Net P&L" },
  { key: "gross", label: "Gross P&L" },
  { key: "r", label: "R-multiple" },
] as const;
export type Metric = (typeof METRICS)[number]["key"];

export const INTERVALS = [15, 30, 60, 120] as const;
export type Interval = (typeof INTERVALS)[number];

export type AnalyticsFilters = { symbol?: string; side?: "LONG" | "SHORT"; setup?: string; session?: string; tag?: string };

export type AnalyticsQuery = {
  tab?: string;
  range: RangeKey;
  /** Custom dates override the preset range. */
  from?: string;
  to?: string;
  by: "entry" | "exit";
  interval: Interval;
  metric: Metric;
  filters: AnalyticsFilters;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
type Params = Record<string, string | string[] | undefined>;
const one = (sp: Params, k: string) => {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
};

export function parseAnalyticsQuery(sp: Params): AnalyticsQuery {
  const from = one(sp, "from");
  const to = one(sp, "to");
  const custom = from && DATE.test(from) && (!to || DATE.test(to));
  const interval = Number(one(sp, "interval"));
  const side = one(sp, "side");
  return {
    tab: one(sp, "tab"),
    range: parseRange(one(sp, "range"), "90d"),
    from: custom ? from : undefined,
    to: custom && to ? to : undefined,
    by: one(sp, "by") === "exit" ? "exit" : "entry",
    interval: (INTERVALS as readonly number[]).includes(interval) ? (interval as Interval) : 60,
    metric: (METRICS.find((m) => m.key === one(sp, "metric"))?.key ?? "net") as Metric,
    filters: {
      symbol: one(sp, "symbol")?.toUpperCase().slice(0, 20),
      side: side === "LONG" || side === "SHORT" ? side : undefined,
      setup: one(sp, "setup"),
      session: one(sp, "session"),
      tag: one(sp, "tag"),
    },
  };
}

export const activeFilterCount = (f: AnalyticsFilters) => Object.values(f).filter(Boolean).length;

export function applyFilters(trades: ATrade[], f: AnalyticsFilters) {
  return trades.filter(
    (t) =>
      (!f.symbol || t.symbol === f.symbol) &&
      (!f.side || t.side === f.side) &&
      (!f.setup || t.setupId === f.setup) &&
      (!f.session || t.session === f.session) &&
      (!f.tag || t.tags.some((g) => g.name === f.tag)),
  );
}

/**
 * Re-express each trade's result in the chosen measure so every chart can
 * keep reading `net`. Gross = before commission and swap. R drops trades
 * without a stop loss.
 */
export function withMetric(trades: ATrade[], metric: Metric): ATrade[] {
  if (metric === "net") return trades;
  if (metric === "gross") return trades.map((t) => ({ ...t, net: Math.round((t.net - t.commission - t.swap) * 100) / 100 }));
  return trades.filter((t) => t.rMultiple != null).map((t) => ({ ...t, net: t.rMultiple! }));
}

/** "09:00", "09:30" … bucket label for a time of day at a given interval. */
export function timeBucket(timeOfDay: number, interval: Interval) {
  const mins = Math.floor((timeOfDay * 60) / interval) * interval;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export function allTimeBuckets(interval: Interval) {
  return Array.from({ length: (24 * 60) / interval }, (_, i) => timeBucket((i * interval) / 60, interval));
}
