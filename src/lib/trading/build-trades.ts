import { round, type Side, type TradeInput } from "./metrics";

export type RawDeal = {
  ticket: string;
  positionId: string | null;
  symbol: string | null;
  type: string; // BUY | SELL | BALANCE | ...
  entry: string | null; // IN | OUT | INOUT | OUT_BY
  volume: number | null;
  price: number | null;
  sl?: number | null;
  tp?: number | null;
  commission: number;
  swap: number;
  fee?: number;
  profit: number;
  time: Date;
};

/**
 * Group MT5 deals into positions. Exness MT5 accounts are hedging accounts, so
 * every position has its own id and is built from IN deals (open / scale in)
 * and OUT deals (partial or full close).
 */
export function buildTradesFromDeals(deals: RawDeal[]): TradeInput[] {
  const byPosition = new Map<string, RawDeal[]>();
  for (const d of deals) {
    if (!d.positionId || !d.symbol || (d.type !== "BUY" && d.type !== "SELL")) continue;
    const list = byPosition.get(d.positionId) ?? [];
    list.push(d);
    byPosition.set(d.positionId, list);
  }

  const trades: TradeInput[] = [];
  for (const [positionId, list] of byPosition) {
    list.sort((a, b) => a.time.getTime() - b.time.getTime());
    const ins = list.filter((d) => d.entry === "IN" || d.entry === "INOUT");
    const outs = list.filter((d) => d.entry === "OUT" || d.entry === "OUT_BY" || d.entry === "INOUT");
    if (ins.length === 0) continue; // opened before the synced window

    const first = ins[0];
    const side: Side = first.type === "BUY" ? "LONG" : "SHORT";
    const inVol = sum(ins.map((d) => d.volume ?? 0));
    const outVol = sum(outs.map((d) => d.volume ?? 0));
    const closed = outs.length > 0 && outVol + 1e-9 >= inVol;

    trades.push({
      positionId,
      symbol: first.symbol!,
      side,
      openTime: first.time,
      closeTime: closed ? outs[outs.length - 1].time : null,
      openPrice: vwap(ins),
      closePrice: outs.length ? vwap(outs) : null,
      volume: round(inVol, 2),
      // Initial stop (first one seen) is what R-multiple is measured against.
      sl: firstDefined(list.map((d) => d.sl)),
      tp: firstDefined(list.map((d) => d.tp)),
      commission: round(sum(list.map((d) => d.commission + (d.fee ?? 0))), 2),
      swap: round(sum(list.map((d) => d.swap)), 2),
      grossPnl: round(sum(list.map((d) => d.profit)), 2),
    });
  }
  return trades.sort((a, b) => a.openTime.getTime() - b.openTime.getTime());
}

function sum(xs: number[]) {
  return xs.reduce((s, x) => s + x, 0);
}

function vwap(ds: RawDeal[]) {
  const vol = sum(ds.map((d) => d.volume ?? 0));
  if (vol === 0) return ds[0].price ?? 0;
  return round(sum(ds.map((d) => (d.price ?? 0) * (d.volume ?? 0))) / vol, 8);
}

function firstDefined(xs: (number | null | undefined)[]) {
  for (const x of xs) if (x) return x;
  return null;
}
