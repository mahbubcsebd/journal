import "server-only";
import { eq, type SQL } from "drizzle-orm";
import { trade } from "@/db/schema";
import { getDataMode, type DataMode } from "@/lib/session";

/** WHERE condition on trade.is_backtest for a data mode (undefined = both). */
export function backtestCond(mode: DataMode): SQL | undefined {
  return mode === "live" ? eq(trade.isBacktest, false) : mode === "backtest" ? eq(trade.isBacktest, true) : undefined;
}

/** Condition for the mode chosen in the top bar (live outside a request). */
export async function currentBacktestCond() {
  return backtestCond(await getDataMode());
}
