/** Which candles to ask the EA for, around a trade. Pure. */
export const TIMEFRAMES = [1, 5, 15, 60, 240] as const;
const BEFORE = 40;
const AFTER = 20;
const MAX_BARS = 400;
const DAY = 86_400_000;

export function candlePlan(openAt: number, closeAt: number, now = Date.now()) {
  const minutes = Math.max(1, (closeAt - openAt) / 60_000);
  // M1 history isn't kept long by brokers; older trades start at M5.
  const options = TIMEFRAMES.filter((tf) => tf > 1 || now - closeAt < 5 * DAY);
  const tf = options.find((tf) => minutes / tf + BEFORE + AFTER <= MAX_BARS) ?? 240;
  const from = Math.floor(openAt / 1000 / 60 / tf) * tf * 60 - BEFORE * tf * 60;
  const to = Math.ceil(closeAt / 1000 / 60 / tf) * tf * 60 + AFTER * tf * 60;
  return { tf, from, to: Math.min(to, Math.floor(now / 1000)) };
}

export type Candle = [number, number, number, number, number];

/** Keep at most `max` candles for the AI: merge neighbours into bigger bars. */
export function downsample(c: Candle[], max = 40): Candle[] {
  if (c.length <= max) return c;
  const size = Math.ceil(c.length / max);
  const out: Candle[] = [];
  for (let i = 0; i < c.length; i += size) {
    const g = c.slice(i, i + size);
    out.push([g[0][0], g[0][1], Math.max(...g.map((x) => x[2])), Math.min(...g.map((x) => x[3])), g[g.length - 1][4]]);
  }
  return out;
}
