import { assetClass, normalizeSymbol, pipSize } from "./trading/symbols";

/** Default contract sizes (units per 1.00 lot) for common Exness instruments. Editable in the UI. */
export function defaultContractSize(symbol: string) {
  const s = normalizeSymbol(symbol);
  switch (assetClass(s)) {
    case "FOREX":
      return 100_000;
    case "METAL":
      return s.startsWith("XAG") ? 5_000 : 100;
    case "ENERGY":
      return 1_000;
    default:
      return 1;
  }
}

export function quoteCurrency(symbol: string) {
  const s = normalizeSymbol(symbol);
  return /^[A-Z]{6}$/.test(s) ? s.slice(3) : "USD";
}

/**
 * USD value of one pip for 1.00 lot. When the quote currency isn't USD we need
 * either the price (USD-based pairs such as USDJPY) or the quote→USD rate (crosses).
 */
export function pipValuePerLot(opts: { symbol: string; price?: number; quoteToUsd?: number; contractSize?: number }) {
  const s = normalizeSymbol(opts.symbol);
  const contract = opts.contractSize ?? defaultContractSize(s);
  const inQuote = contract * pipSize(s);
  const quote = quoteCurrency(s);
  if (quote === "USD") return inQuote;
  if (s.startsWith("USD") && opts.price) return inQuote / opts.price;
  if (opts.quoteToUsd) return inQuote * opts.quoteToUsd;
  return null;
}

export function positionSize(opts: { riskAmount: number; stopPips: number; pipValue: number; lotStep?: number }) {
  const { riskAmount, stopPips, pipValue, lotStep = 0.01 } = opts;
  if (riskAmount <= 0 || stopPips <= 0 || pipValue <= 0) return null;
  const raw = riskAmount / (stopPips * pipValue);
  const lots = Math.floor(raw / lotStep + 1e-9) * lotStep;
  const r = Math.round(lots * 100) / 100;
  return { lots: r, rawLots: raw, actualRisk: Math.round(r * stopPips * pipValue * 100) / 100 };
}

export function riskReward(opts: { side: "LONG" | "SHORT"; entry: number; sl: number; tp?: number | null; symbol: string }) {
  const { side, entry, sl, tp, symbol } = opts;
  const pip = pipSize(symbol);
  const riskDist = side === "LONG" ? entry - sl : sl - entry;
  if (riskDist <= 0) return { error: side === "LONG" ? "For a buy, the stop must be below entry." : "For a sell, the stop must be above entry." } as const;
  const rewardDist = tp == null ? null : side === "LONG" ? tp - entry : entry - tp;
  if (rewardDist != null && rewardDist <= 0)
    return { error: side === "LONG" ? "For a buy, the target must be above entry." : "For a sell, the target must be below entry." } as const;
  const rr = rewardDist == null ? null : rewardDist / riskDist;
  return {
    slPips: Math.round((riskDist / pip) * 10) / 10,
    tpPips: rewardDist == null ? null : Math.round((rewardDist / pip) * 10) / 10,
    rr,
    breakevenWinRate: rr == null ? null : 1 / (1 + rr),
  } as const;
}

/** Gain needed to get back to break-even after losing `lossPct` (0–1). */
export const recoveryNeeded = (lossPct: number) => (lossPct >= 1 ? Infinity : 1 / (1 - lossPct) - 1);

/** Probability of at least one run of `streak` consecutive losses within `trades` trades. */
export function losingStreakProbability(winRate: number, streak: number, trades: number) {
  const q = 1 - winRate;
  if (streak <= 0) return 1;
  if (trades < streak) return 0;
  // state[k] = probability that the current trailing loss run is k and no full streak yet
  let state = new Array(streak).fill(0);
  state[0] = 1;
  let hit = 0;
  for (let i = 0; i < trades; i++) {
    const next = new Array(streak).fill(0);
    for (let k = 0; k < streak; k++) {
      next[0] += state[k] * winRate;
      if (k + 1 === streak) hit += state[k] * q;
      else next[k + 1] += state[k] * q;
    }
    state = next;
  }
  return hit;
}
