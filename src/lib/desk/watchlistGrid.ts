import type { TF } from "./types";

export interface GridPaneSpec {
  id: string;
  symbol: string;
  defaultTf: TF;
}

export const GRID_TFS: readonly TF[] = ["M5", "M15", "H1", "H4", "D1"];
export const SINGLE_SYMBOL_TFS: readonly TF[] = ["M15", "H1", "H4"];
const MAX_PANES = 6;

/**
 * Builds deterministic watchlist chart pane specs without mutating input arrays.
 * When multiple symbols are available, shows one pane per symbol on `baseTf`;
 * when only one symbol is available, spreads it across M15/H1/H4.
 */
export function buildWatchlistPanes(symbols: readonly string[], baseTf: TF): GridPaneSpec[] {
  const unique: string[] = [];
  for (const raw of symbols) {
    const sym = raw.trim().toUpperCase();
    if (sym && !unique.includes(sym)) unique.push(sym);
  }
  const active = unique.length > 0 ? unique : ["XAUUSD"];
  if (active.length === 1) {
    const sym = active[0];
    return SINGLE_SYMBOL_TFS.map((tf) => ({ id: `${sym}:${tf}`, symbol: sym, defaultTf: tf }));
  }
  return active.slice(0, MAX_PANES).map((symbol) => ({
    id: symbol,
    symbol,
    defaultTf: baseTf,
  }));
}

