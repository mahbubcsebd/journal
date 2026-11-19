"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

export type Slice = { label: string; value: number; color: string; sub?: string };

/** Donut of shares (e.g. trades per session) with a legend; values must be positive. */
export function SharePie({ data, center, centerSub }: { data: Slice[]; center?: string; centerSub?: string }) {
  const shown = data.filter((d) => d.value > 0);
  const total = shown.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-52 w-full sm:w-1/2">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="92%" paddingAngle={2} stroke="var(--card)" animationDuration={600}>
              {shown.map((d) => (
                <Cell key={d.label} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as Slice | undefined;
                if (!active || !d) return null;
                return <ChartTooltip title={d.label} rows={[{ label: "Share", value: `${Math.round((d.value / total) * 100)}%`, swatch: d.color }, ...(d.sub ? [{ label: "", value: d.sub }] : [])]} />;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {center && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-mono font-semibold tabular", center.length > 7 ? "text-sm" : "text-2xl")}>{center}</span>
            {centerSub && <span className="text-xs text-muted-foreground">{centerSub}</span>}
          </div>
        )}
      </div>
      <ul className="grid w-full gap-2 text-sm sm:w-1/2">
        {shown.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate">{d.label}</span>
            {d.sub && <span className="text-xs text-muted-foreground">{d.sub}</span>}
            <span className="w-10 text-right font-mono text-xs font-medium tabular">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
