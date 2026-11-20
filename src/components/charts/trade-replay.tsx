"use client";

import { CandlestickSeries, ColorType, createChart, createSeriesMarkers, LineStyle, type UTCTimestamp } from "lightweight-charts";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { tzOffset } from "@/lib/market-sessions";

type Candle = [number, number, number, number, number];

/** A CSS colour token (oklch etc.) → rgb() the chart's canvas can use. */
function cssColor(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = fallback;
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

/** Candles around a trade with entry, stop, target and exit drawn on. Times shown in the trader's zone. */
export function TradeReplay({
  candles,
  timeframe,
  timezone,
  side,
  entry,
  exit,
  sl,
  tp,
  openAt,
  closeAt,
  digits,
}: {
  candles: Candle[];
  timeframe: number;
  timezone: string;
  side: "LONG" | "SHORT";
  entry: number;
  exit: number | null;
  sl: number | null;
  tp: number | null;
  openAt: number;
  closeAt: number | null;
  digits: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!box.current) return;
    const up = cssColor("--chart-up", "#16a34a");
    const down = cssColor("--chart-down", "#f97316");
    const text = cssColor("--muted-foreground", "#888");
    const grid = cssColor("--border", "#ddd");
    const loss = cssColor("--loss", "#dc2626");
    const profit = cssColor("--profit", "#059669");
    const fg = cssColor("--foreground", "#111");
    const brand = cssColor("--brand", "#10b981");
    // lightweight-charts draws in UTC: shift by the zone offset to show local time.
    const shift = (s: number) => (s + Math.round(tzOffset(s * 1000, timezone) / 1000)) as UTCTimestamp;
    const bar = (ms: number) => shift(Math.floor(ms / 1000 / 60 / timeframe) * timeframe * 60);

    const chart = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: text, fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      localization: { priceFormatter: (p: number) => p.toFixed(digits) },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
      priceFormat: { type: "price", precision: digits, minMove: 1 / 10 ** digits },
    });
    series.setData(candles.map(([t, o, h, l, c]) => ({ time: shift(t), open: o, high: h, low: l, close: c })));
    const line = (price: number | null, color: string, title: string, style = LineStyle.Dashed) =>
      price != null && series.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });
    line(entry, fg, "Entry", LineStyle.Solid);
    line(sl, loss, "SL");
    line(tp, profit, "TP");
    if (exit != null) line(exit, brand, "Exit", LineStyle.Dotted);
    createSeriesMarkers(series, [
      {
        time: bar(openAt),
        position: side === "LONG" ? "belowBar" : "aboveBar",
        color: fg,
        shape: side === "LONG" ? "arrowUp" : "arrowDown",
        text: side === "LONG" ? "Buy" : "Sell",
      },
      ...(closeAt != null
        ? [{ time: bar(closeAt), position: side === "LONG" ? ("aboveBar" as const) : ("belowBar" as const), color: brand, shape: "circle" as const, text: "Exit" }]
        : []),
    ]);
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, timeframe, timezone, side, entry, exit, sl, tp, openAt, closeAt, digits, resolvedTheme]);

  return <div ref={box} className="h-80 w-full sm:h-96" role="img" aria-label="Price chart around this trade with entry, stop loss, take profit and exit" />;
}
