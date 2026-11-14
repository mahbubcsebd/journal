"use client";

import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart as RScatter, Tooltip, XAxis, YAxis } from "recharts";
import { formatDuration } from "@/lib/trading/metrics";
import { formatMoney } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

type P = { x: number; y: number; symbol: string; id: string };
const tick = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Hold time (log scale) against net P&L, one dot per trade. */
export function DurationScatter({ points, currency }: { points: P[]; currency: string }) {
  const xs = points.map((p) => p.x);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const ticks = [60, 300, 900, 3600, 4 * 3600, 86_400, 7 * 86_400].filter((t) => t >= lo * 0.8 && t <= hi * 1.2);
  const wins = points.filter((p) => p.y >= 0);
  const losses = points.filter((p) => p.y < 0);
  const dot = (fill: string) =>
    function Dot(props: { cx?: number; cy?: number }) {
      return <circle cx={props.cx} cy={props.cy} r={4.5} fill={fill} fillOpacity={0.75} stroke="var(--card)" strokeWidth={1.5} />;
    };
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <RScatter margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis
            dataKey="x"
            type="number"
            scale="log"
            domain={[Math.max(1, lo * 0.8), hi * 1.2]}
            ticks={ticks}
            tickFormatter={(v) => formatDuration(Math.round(v))}
            tick={tick}
            axisLine={false}
            tickLine={false}
            name="Hold time"
          />
          <YAxis dataKey="y" type="number" width={64} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} tick={tick} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as P | undefined;
              if (!active || !p) return null;
              return (
                <ChartTooltip
                  title={p.symbol}
                  rows={[
                    { label: "Net P&L", value: formatMoney(p.y, currency, { sign: true }), tone: p.y },
                    { label: "Held", value: formatDuration(p.x) },
                  ]}
                />
              );
            }}
          />
          <Scatter name="Wins" data={wins} shape={dot("var(--chart-up)")} />
          <Scatter name="Losses" data={losses} shape={dot("var(--chart-down)")} />
        </RScatter>
      </ResponsiveContainer>
    </div>
  );
}
