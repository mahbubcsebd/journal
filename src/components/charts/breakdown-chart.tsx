"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GroupRow } from "@/lib/analytics";
import { formatMoney, formatPercent } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

const tick = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Net P&L per category; bars diverge from zero so sign is read from position too. */
export function BreakdownChart({ rows, currency, height = 220 }: { rows: GroupRow[]; currency: string; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={rows.length > 12 ? 2 : "18%"}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="key" tick={tick} axisLine={false} tickLine={false} interval={rows.length > 12 ? 1 : 0} />
          <YAxis width={64} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} tick={tick} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
          <Tooltip
            cursor={{ fill: "var(--muted)", fillOpacity: 0.6 }}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as GroupRow | undefined;
              if (!active || !r) return null;
              return (
                <ChartTooltip
                  title={r.key}
                  rows={[
                    { label: "Net P&L", value: formatMoney(r.net, currency, { sign: true }), tone: r.net },
                    { label: "Trades", value: String(r.trades) },
                    { label: "Win rate", value: r.winRate == null ? "—" : formatPercent(r.winRate, 0) },
                    { label: "Profit factor", value: r.profitFactor == null ? "—" : r.profitFactor.toFixed(2) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="net" radius={[4, 4, 0, 0]} maxBarSize={40} animationDuration={600}>
            {rows.map((r) => (
              <Cell key={r.key} fill={r.net >= 0 ? "var(--chart-up)" : "var(--chart-down)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
