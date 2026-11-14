import type { CSSProperties } from "react";

/**
 * Diverging fill: teal-green arm for profit, coral arm for loss, card surface
 * as the neutral midpoint. Square-root scaling keeps small days visible next
 * to one huge day.
 */
export function pnlFill(net: number, maxAbs: number, strength = 1): CSSProperties | undefined {
  if (!net || !maxAbs) return undefined;
  const t = Math.sqrt(Math.min(1, Math.abs(net) / maxAbs));
  const token = net > 0 ? "--chart-up" : "--chart-down";
  const fill = Math.round((10 + 30 * t) * strength);
  const edge = Math.round((22 + 40 * t) * strength);
  return {
    background: `color-mix(in oklch, var(${token}) ${fill}%, var(--card))`,
    borderColor: `color-mix(in oklch, var(${token}) ${edge}%, var(--border))`,
  };
}

export const pnlText = (n: number) => (n > 0 ? "text-profit" : n < 0 ? "text-loss" : "text-muted-foreground");
