import type { TradeInput } from "@/lib/trading/metrics";
import type { JournalTrade } from "./types";

/** Statuses on the SMC server that mean the paper position has been exited. */
const CLOSED = new Set<JournalTrade["status"]>(["won", "lost", "closed"]);

const toDate = (unixSec: number) => new Date(unixSec * 1000);

/** Exit price: the recorded one, else rebuilt from the R result (entry ± R × risk). */
function exitPrice(t: JournalTrade): number | null {
  if (typeof t.exitPrice === "number") return t.exitPrice;
  if (typeof t.resultR !== "number") return null;
  const risk = Math.abs(t.entry - t.stop);
  const sign = t.dir === "bull" ? 1 : -1;
  return Number((t.entry + sign * t.resultR * risk).toFixed(t.digits));
}

/**
 * SMC paper trades → Journal trade rows. Skips MT5 copies (Journal already
 * gets those from the EA), never-filled orders and cancelled ones. The SMC id
 * becomes `positionId`, so re-syncing updates rows instead of duplicating them.
 */
export function mapPaperTrades(trades: readonly JournalTrade[]): TradeInput[] {
  return trades
    .filter((t) => t.source !== "mt5" && t.status !== "pending" && t.status !== "cancelled")
    .map((t) => {
      const closed = CLOSED.has(t.status);
      return {
        positionId: `smc:${t.id}`,
        symbol: t.symbol,
        side: t.dir === "bull" ? "LONG" : "SHORT",
        openTime: toDate(t.filledAt ?? t.createdAt),
        closeTime: closed ? toDate(t.closedAt ?? t.filledAt ?? t.createdAt) : null,
        openPrice: t.entry,
        closePrice: closed ? exitPrice(t) : null,
        volume: t.volume ?? 0,
        sl: t.stop,
        tp: t.target,
        commission: 0,
        swap: 0,
        grossPnl: closed ? (t.pnlUsd ?? 0) : 0,
      };
    });
}
