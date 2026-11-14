"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

type Bin = { from: number; to: number; count: number };
const tick = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Count of trades per bin; bins below zero use the loss arm, at/above zero the profit arm. */
export function HistogramChart({
  bins,
  kind,
  currency = "USD",
  unit = "trades",
}: {
  bins: Bin[];
  kind: "r" | "money";
  currency?: string;
  unit?: string;
}) {
  const format = (n: number) => (kind === "r" ? `${n}R` : formatMoney(n, currency, { compact: true }));
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <BarChart data={bins} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="from" tickFormatter={format} tick={tick} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis width={36} allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)", fillOpacity: 0.6 }}
            content={({ active, payload }) => {
              const b = payload?.[0]?.payload as Bin | undefined;
              if (!active || !b) return null;
              return <ChartTooltip title={`${format(b.from)} to ${format(b.to)}`} rows={[{ label: unit, value: String(b.count) }]} />;
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={600}>
            {bins.map((b) => (
              <Cell key={b.from} fill={b.from < 0 ? "var(--chart-down)" : "var(--chart-up)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
