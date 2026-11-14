"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDay } from "@/lib/dates";
import type { DailyPoint } from "@/lib/stats";
import { formatMoney, formatPercent } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Diverging bars around zero: polarity is carried by position and sign as well as colour. */
export function DailyPnlChart({ data, currency }: { data: DailyPoint[]; currency: string }) {
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="day"
            tickFormatter={(d) => formatDay(d, { month: "short", day: "numeric" })}
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis width={68} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} tick={axisTick} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
          <Tooltip
            cursor={{ fill: "var(--muted)", fillOpacity: 0.6 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as DailyPoint | undefined;
              if (!active || !p) return null;
              const decided = p.wins + p.losses;
              return (
                <ChartTooltip
                  title={formatDay(p.day, { weekday: "short", month: "short", day: "numeric" })}
                  rows={[
                    { label: "Net P&L", value: formatMoney(p.net, currency, { sign: true }), tone: p.net },
                    { label: "Trades", value: String(p.trades) },
                    { label: "Win rate", value: decided ? formatPercent(p.wins / decided, 0) : "—" },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="net" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={700}>
            {data.map((d) => (
              <Cell key={d.day} fill={d.net >= 0 ? "var(--chart-up)" : "var(--chart-down)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
