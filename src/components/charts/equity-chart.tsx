"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDay } from "@/lib/dates";
import type { EquityPoint } from "@/lib/stats";
import { formatMoney } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };
const shortDay = (d: string) => formatDay(d, { month: "short", day: "numeric" });

/** Cumulative net P&L (one series, so no legend: the card title names it) and its drawdown underneath. */
export function EquityChart({ data, currency }: { data: EquityPoint[]; currency: string }) {
  const series = data.length === 1 ? [{ ...data[0], day: data[0].day }, data[0]] : data;
  const money = (v: number) => formatMoney(v, currency, { compact: true });
  const deepest = Math.min(-1, ...series.map((p) => p.drawdown));

  const tooltip = ({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) => {
    const p = payload?.[0]?.payload as EquityPoint | undefined;
    if (!active || !p) return null;
    return (
      <ChartTooltip
        title={formatDay(p.day, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
        rows={[
          { label: "Equity", value: formatMoney(p.equity, currency, { sign: true }), tone: p.equity },
          { label: "Day", value: formatMoney(p.net, currency, { sign: true }), tone: p.net },
          { label: "Drawdown", value: p.drawdown ? formatMoney(p.drawdown, currency) : "At peak", tone: p.drawdown },
        ]}
      />
    );
  };

  return (
    <div className="grid gap-1">
      <div className="h-64">
        <ResponsiveContainer>
          <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} syncId="equity">
            <defs>
              <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" tickFormatter={shortDay} tick={axisTick} axisLine={false} tickLine={false} minTickGap={48} />
            <YAxis width={68} tickFormatter={money} tick={axisTick} axisLine={false} tickLine={false} />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.35} />
            <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} content={tooltip} />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="var(--brand)"
              strokeWidth={2}
              fill="url(#equity-fill)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)", fill: "var(--brand)" }}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] font-medium text-muted-foreground">Drawdown from peak</p>
      <div className="h-24">
        <ResponsiveContainer>
          <AreaChart data={series} margin={{ top: 6, right: 8, bottom: 6, left: 0 }} syncId="equity">
            <XAxis dataKey="day" hide />
            <YAxis
              width={68}
              domain={[deepest, 0]}
              ticks={[deepest, 0]}
              interval={0}
              tickFormatter={money}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} content={tooltip} />
            <Area
              type="monotone"
              dataKey="drawdown"
              stroke="var(--chart-down)"
              strokeWidth={2}
              fill="var(--chart-down)"
              fillOpacity={0.15}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--chart-down)" }}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
