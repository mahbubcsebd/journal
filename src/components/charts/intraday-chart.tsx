"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

type Point = { time: number; net: number; symbol: string };

/** Cumulative P&L after each closed trade, as a step line from zero. */
export function IntradayChart({ points, currency, timezone }: { points: Point[]; currency: string; timezone: string }) {
  const data = points.reduce(
    (acc, p) => {
      const equity = Math.round((acc[acc.length - 1].equity + p.net) * 100) / 100;
      return [...acc, { time: p.time, equity, label: p.symbol, trade: p.net }];
    },
    [{ time: points[0].time - 60_000, equity: 0, label: "Start", trade: 0 }],
  );
  const final = data[data.length - 1].equity;
  const time = (t: number) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(t);

  return (
    <div className="mt-2 h-44">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="intraday-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={final >= 0 ? "var(--chart-up)" : "var(--chart-down)"} stopOpacity={0.25} />
              <stop offset="100%" stopColor={final >= 0 ? "var(--chart-up)" : "var(--chart-down)"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={time}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            width={64}
            tickFormatter={(v) => formatMoney(v, currency, { compact: true })}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.4} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !p) return null;
              return (
                <ChartTooltip
                  title={`${time(p.time)} · ${p.label}`}
                  rows={[
                    ...(p.trade ? [{ label: "Trade", value: formatMoney(p.trade, currency, { sign: true }), tone: p.trade }] : []),
                    { label: "Running", value: formatMoney(p.equity, currency, { sign: true }), tone: p.equity },
                  ]}
                />
              );
            }}
          />
          <Area
            type="stepAfter"
            dataKey="equity"
            stroke={final >= 0 ? "var(--chart-up)" : "var(--chart-down)"}
            strokeWidth={2}
            fill="url(#intraday-fill)"
            dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: final >= 0 ? "var(--chart-up)" : "var(--chart-down)" }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
