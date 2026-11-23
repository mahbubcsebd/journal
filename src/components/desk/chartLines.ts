import { LineStyle, type IPriceLine, type ISeriesApi, type SeriesMarker, type Time, type UTCTimestamp } from "lightweight-charts";
import { COLORS } from "@/lib/desk/format";
import type { Layers } from "@/lib/desk/settings";
import type { Analysis, OpenPosition, PriceAlert } from "@/lib/desk/types";
import { matchesSymbol } from "@/lib/desk/useAccount";

export function buildChartMarkers(analysis: Analysis | null, layers: Layers, firstTime: number, lastTime: number): SeriesMarker<Time>[] {
  const marks: SeriesMarker<Time>[] = [];
  if (!analysis) return marks;

  if (layers.swings) {
    for (const sw of analysis.swings) {
      if (sw.time < firstTime || sw.time > lastTime) continue;
      marks.push({
        time: sw.time as UTCTimestamp,
        position: sw.kind === "high" ? "aboveBar" : "belowBar",
        shape: "circle",
        size: 0,
        color: COLORS.mute,
        text: sw.label,
      });
    }
  }
  if (layers.liquidity) {
    for (const sw of analysis.sweeps) {
      if (sw.time < firstTime || sw.time > lastTime) continue;
      marks.push({
        time: sw.time as UTCTimestamp,
        position: sw.side === "buy" ? "aboveBar" : "belowBar",
        shape: sw.side === "buy" ? "arrowDown" : "arrowUp",
        color: COLORS.gold,
        text: "Sweep",
      });
    }
  }
  const judas = analysis.judas;
  if (layers.sessions && judas && judas.time >= firstTime && judas.time <= lastTime) {
    marks.push({
      time: judas.time as UTCTimestamp,
      position: judas.side === "high" ? "aboveBar" : "belowBar",
      shape: judas.side === "high" ? "arrowDown" : "arrowUp",
      color: judas.dir === "bull" ? COLORS.jade : COLORS.coral,
      text: "Judas",
    });
  }
  marks.sort((a, b) => (a.time as number) - (b.time as number));
  return marks;
}

export function syncSetupLines(s: ISeriesApi<"Candlestick">, prev: IPriceLine[], analysis: Analysis | null): IPriceLine[] {
  for (const line of prev) s.removePriceLine(line);
  const setup = analysis?.setup;
  if (!setup) return [];
  const add = (price: number, title: string, color: string) =>
    s.createPriceLine({ price, title, color, lineWidth: 1, lineStyle: LineStyle.LargeDashed, axisLabelVisible: true });
  return [add(setup.entry, "Entry", COLORS.ink), add(setup.stop, "Stop", COLORS.coral), add(setup.target, "Target", COLORS.jade)];
}

export function syncPositionLines(s: ISeriesApi<"Candlestick">, prev: IPriceLine[], positions: readonly OpenPosition[], symbol: string): IPriceLine[] {
  for (const line of prev) s.removePriceLine(line);
  const next: IPriceLine[] = [];
  for (const p of positions) {
    if (!matchesSymbol(p.symbol, symbol)) continue;
    const net = p.profit + p.swap;
    const sign = net >= 0 ? "+" : "";
    const side = p.dir === "bull" ? "BUY" : "SELL";
    const color = p.dir === "bull" ? COLORS.jade : COLORS.coral;
    next.push(
      s.createPriceLine({
        price: p.priceOpen,
        title: `${side} ${p.volume.toFixed(2)} (${sign}$${net.toFixed(2)})`,
        color,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
      }),
    );
    if (p.sl !== null && p.sl > 0) {
      next.push(s.createPriceLine({ price: p.sl, title: `SL #${p.ticket}`, color: COLORS.coral, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true }));
    }
    if (p.tp !== null && p.tp > 0) {
      next.push(s.createPriceLine({ price: p.tp, title: `TP #${p.ticket}`, color: COLORS.jade, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true }));
    }
  }
  return next;
}

export function syncAlertLines(s: ISeriesApi<"Candlestick">, prev: IPriceLine[], alerts: readonly PriceAlert[], symbol: string): IPriceLine[] {
  for (const line of prev) s.removePriceLine(line);
  const next: IPriceLine[] = [];
  for (const a of alerts) {
    if (!a.active || a.targetPrice === null || a.symbol !== symbol) continue;
    next.push(
      s.createPriceLine({
        price: a.targetPrice,
        title: `Alert ${a.condition === "above" ? "↑" : "↓"}`,
        color: COLORS.gold,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
      }),
    );
  }
  return next;
}

