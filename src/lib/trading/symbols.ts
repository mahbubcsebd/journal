/**
 * Exness appends a suffix to symbol names depending on account type:
 * Standard "m" (EURUSDm), Cent "c" (EURUSDc), Raw/Zero/Pro sometimes "z"/"r".
 * Normalising lets the same instrument be compared across sub-accounts.
 */
const SUFFIX = /^(.*?)(m|c|z|r|\.pro|\.raw|\.ecn|_i)$/i;

const KNOWN_BASES = [
  "XAUUSD", "XAGUSD", "XAUEUR", "XPTUSD", "XPDUSD",
  "BTCUSD", "ETHUSD", "LTCUSD", "XRPUSD", "SOLUSD", "BNBUSD", "DOGEUSD", "ADAUSD", "DOTUSD",
  "USOIL", "UKOIL", "XNGUSD",
  "US30", "US500", "USTEC", "UK100", "DE30", "DE40", "JP225", "FR40", "AUS200", "HK50", "STOXX50",
  "DXY",
];

export function normalizeSymbol(raw: string): string {
  // Exness writes the suffix in lower case after an upper-case base: "USTECm".
  const lower = raw.trim().match(/^([A-Z0-9]{3,})([a-z]{1,3})$/);
  if (lower) return lower[1];
  const s = raw.trim().toUpperCase();
  if (KNOWN_BASES.includes(s) || /^[A-Z]{6}$/.test(s)) return s;
  const m = s.match(SUFFIX);
  if (m) {
    const base = m[1];
    if (KNOWN_BASES.includes(base) || /^[A-Z]{6}$/.test(base)) return base;
  }
  return s;
}

export type AssetClass = "FOREX" | "METAL" | "CRYPTO" | "INDEX" | "ENERGY" | "OTHER";

export function assetClass(symbol: string): AssetClass {
  const s = normalizeSymbol(symbol);
  if (/^X(AU|AG|PT|PD)/.test(s)) return "METAL";
  if (/^(BTC|ETH|LTC|XRP|SOL|BNB|DOGE|ADA|DOT)/.test(s)) return "CRYPTO";
  if (/OIL|XNG/.test(s)) return "ENERGY";
  if (/^(US30|US500|USTEC|UK100|DE\d\d|JP225|FR40|AUS200|HK50|STOXX50|DXY)$/.test(s)) return "INDEX";
  if (/^[A-Z]{6}$/.test(s)) return "FOREX";
  return "OTHER";
}

/** Price distance of one pip, using the conventions most retail traders use. */
export function pipSize(symbol: string): number {
  const s = normalizeSymbol(symbol);
  switch (assetClass(s)) {
    case "FOREX":
      return s.endsWith("JPY") ? 0.01 : 0.0001;
    case "METAL":
      return s.startsWith("XAG") ? 0.01 : 0.1;
    case "ENERGY":
      return 0.01;
    case "INDEX":
    case "CRYPTO":
      return 1;
    default:
      return 0.0001;
  }
}
