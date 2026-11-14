import { pipSize } from "./symbols";

export type Side = "LONG" | "SHORT";
export type MarketSession = "ASIA" | "LONDON" | "NEW_YORK" | "LONDON_NY_OVERLAP" | "OFF_HOURS";

/** Signed price move in the trade's favour. */
export function favourableMove(side: Side, openPrice: number, closePrice: number) {
  return side === "LONG" ? closePrice - openPrice : openPrice - closePrice;
}

export function computePips(symbol: string, side: Side, openPrice: number, closePrice: number | null) {
  if (closePrice == null) return null;
  return round(favourableMove(side, openPrice, closePrice) / pipSize(symbol), 1);
}

/**
 * R-multiple from prices: how many times the initial stop distance the trade
 * made. Needs a stop loss; contract size cancels out so it works for any symbol.
 */
export function computeRMultiple(side: Side, openPrice: number, closePrice: number | null, sl: number | null) {
  if (closePrice == null || sl == null || sl === 0) return null;
  const risk = Math.abs(openPrice - sl);
  if (risk === 0) return null;
  // A stop on the wrong side of entry (e.g. moved to profit) isn't an initial risk.
  if ((side === "LONG" && sl > openPrice) || (side === "SHORT" && sl < openPrice)) return null;
  return round(favourableMove(side, openPrice, closePrice) / risk, 2);
}

/** Session by the UTC hour the trade was opened in. */
export function marketSession(openTime: Date): MarketSession {
  const h = openTime.getUTCHours();
  if (h >= 12 && h < 16) return "LONDON_NY_OVERLAP";
  if (h >= 7 && h < 12) return "LONDON";
  if (h >= 16 && h < 21) return "NEW_YORK";
  if (h >= 23 || h < 7) return "ASIA";
  return "OFF_HOURS";
}

export const SESSION_LABEL: Record<MarketSession, string> = {
  ASIA: "Asia",
  LONDON: "London",
  NEW_YORK: "New York",
  LONDON_NY_OVERLAP: "London/NY overlap",
  OFF_HOURS: "Off hours",
};

export function durationSec(openTime: Date, closeTime: Date | null) {
  return closeTime ? Math.max(0, Math.round((closeTime.getTime() - openTime.getTime()) / 1000)) : null;
}

export function formatDuration(sec: number | null | undefined) {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function round(n: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export type TradeInput = {
  positionId: string | null;
  symbol: string;
  side: Side;
  openTime: Date;
  closeTime: Date | null;
  openPrice: number;
  closePrice: number | null;
  volume: number;
  sl: number | null;
  tp: number | null;
  commission: number;
  swap: number;
  grossPnl: number;
};

/** Everything derived from the raw fields, so every source computes identically. */
export function deriveTrade(t: TradeInput) {
  return {
    ...t,
    status: t.closeTime ? ("CLOSED" as const) : ("OPEN" as const),
    netPnl: round(t.grossPnl + t.commission + t.swap, 2),
    pips: computePips(t.symbol, t.side, t.openPrice, t.closePrice),
    rMultiple: computeRMultiple(t.side, t.openPrice, t.closePrice, t.sl),
    durationSec: durationSec(t.openTime, t.closeTime),
    session: marketSession(t.openTime),
  };
}
