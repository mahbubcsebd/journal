export const SORTS = ["date", "pnl", "volume", "duration", "r"] as const;

export type TradeFilters = {
  symbol?: string;
  side?: "LONG" | "SHORT";
  result?: "win" | "loss" | "be";
  status?: "OPEN" | "CLOSED";
  session?: string;
  from?: string;
  to?: string;
  tag?: string;
  setup?: string;
  source?: string;
  sort: (typeof SORTS)[number];
  dir: "asc" | "desc";
  page: number;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Params = Record<string, string | string[] | undefined>;

export function parseTradeFilters(sp: Params): TradeFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const pick = <T extends string>(k: string, allowed: readonly T[]) => {
    const v = one(k);
    return allowed.includes(v as T) ? (v as T) : undefined;
  };
  return {
    symbol: one("symbol")?.toUpperCase().slice(0, 20),
    side: pick("side", ["LONG", "SHORT"] as const),
    result: pick("result", ["win", "loss", "be"] as const),
    status: pick("status", ["OPEN", "CLOSED"] as const),
    session: pick("session", ["ASIA", "LONDON", "NEW_YORK", "LONDON_NY_OVERLAP", "OFF_HOURS"] as const),
    from: DATE.test(one("from") ?? "") ? one("from") : undefined,
    to: DATE.test(one("to") ?? "") ? one("to") : undefined,
    tag: one("tag"),
    setup: one("setup"),
    source: pick("source", ["METAAPI", "EA", "IMPORT", "MANUAL"] as const),
    sort: pick("sort", SORTS) ?? "date",
    dir: pick("dir", ["asc", "desc"] as const) ?? "desc",
    page: Math.max(1, Math.min(10_000, Number(one("page")) || 1)),
  };
}

export function filtersToQuery(f: Partial<TradeFilters>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v == null || v === "") continue;
    if (k === "sort" && v === "date") continue;
    if (k === "dir" && v === "desc") continue;
    if (k === "page" && v === 1) continue;
    q.set(k, String(v));
  }
  return q.toString();
}
