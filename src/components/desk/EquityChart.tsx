"use client";

import {
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS, fmt, fmtR, fmtTime, rgba } from "@/lib/desk/format";
import type { BacktestTrade } from "@/lib/desk/types";

export interface EquityPointInput {
  time: number;
  value: number;
}

interface Props {
  trades?: BacktestTrade[];
  from?: number;
  points?: EquityPointInput[];
  unit?: "R" | "USD";
  localTime: boolean;
  label: string;
}

function formatMetric(value: number, unit: "R" | "USD"): string {
  if (unit === "USD") {
    return `${value > 0 ? "+" : value < 0 ? "-" : ""}$${fmt(Math.abs(value), 2)}`;
  }
  return fmtR(value);
}

export default function EquityChart({ trades, from = 0, points: rawPoints, unit = "R", localTime, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ val: number; time: number } | null>(null);

  const seriesData = useMemo<LineData<UTCTimestamp>[]>(() => {
    if (rawPoints && rawPoints.length > 0) {
      const baseTime = rawPoints[0].time - 60;
      const out: LineData<UTCTimestamp>[] = [{ time: baseTime as UTCTimestamp, value: 0 }];
      let prevTime = baseTime;
      for (const p of rawPoints) {
        const t = Math.max(prevTime + 1, p.time);
        prevTime = t;
        out.push({ time: t as UTCTimestamp, value: p.value });
      }
      return out;
    }
    if (!trades || trades.length === 0) return [];
    const baseTime = Math.min(from || trades[0].entryTime, trades[0].entryTime) - 60;
    const out: LineData<UTCTimestamp>[] = [{ time: baseTime as UTCTimestamp, value: 0 }];
    let equity = 0;
    let prevTime = baseTime;
    for (const tr of trades) {
      equity = Math.round((equity + tr.resultR) * 10000) / 10000;
      const t = Math.max(prevTime + 1, tr.exitTime);
      prevTime = t;
      out.push({ time: t as UTCTimestamp, value: equity });
    }
    return out;
  }, [trades, from, rawPoints]);

  const finalVal = seriesData.length ? seriesData[seriesData.length - 1].value : 0;

  useEffect(() => {
    const el = box.current;
    if (!el || seriesData.length === 0) return;
    const up = finalVal >= 0;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: COLORS.mute,
        fontFamily: '"Schibsted Grotesk Variable", system-ui, sans-serif',
        fontSize: 12,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: rgba(COLORS.line, 0.35) },
        horzLines: { color: rgba(COLORS.line, 0.35) },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: COLORS.mute, labelBackgroundColor: "#1b313b" },
        horzLine: { color: COLORS.mute, labelBackgroundColor: "#1b313b" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      localization: {
        priceFormatter: (p: number) => formatMetric(p, unit),
        timeFormatter: (t: number) => fmtTime(t, localTime),
      },
    });

    const line = chart.addSeries(LineSeries, {
      color: up ? COLORS.jade : COLORS.coral,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    line.setData(seriesData);
    line.createPriceLine({
      price: 0,
      color: COLORS.line,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    });
    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHover(null);
        return;
      }
      const d = param.seriesData.get(line) as LineData<UTCTimestamp> | undefined;
      if (!d || typeof d.value !== "number") {
        setHover(null);
        return;
      }
      setHover({ val: d.value, time: Number(param.time) });
    });

    return () => {
      setHover(null);
      chart.remove();
    };
  }, [seriesData, finalVal, localTime, unit]);

  const active = hover ?? (seriesData.length ? { val: finalVal, time: Number(seriesData[seriesData.length - 1].time) } : null);

  return (
    <div className="relative">
      {active && (
        <div className="pointer-events-none mb-2 flex items-center justify-between text-[13px] tabular-nums">
          <span className="text-mute">{fmtTime(active.time, localTime)}</span>
          <span className={`font-semibold ${active.val >= 0 ? "text-jade" : "text-coral"}`}>{formatMetric(active.val, unit)}</span>
        </div>
      )}
      <div ref={box} role="img" aria-label={label} className="h-[220px] w-full" />
    </div>
  );
}
