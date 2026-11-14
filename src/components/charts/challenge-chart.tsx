"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

type P = { day: string; balance: number; floor: number; target: number };
const tick = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Balance against the pass line (target) and the fail line (floor); one money axis. */
export function ChallengeChart({ data, currency, height = 280 }: { data: P[]; currency: string; height?: number }) {
  const series = data.length === 1 ? [data[0], data[0]] : data;
  return (
    <div className="grid gap-2">
      <div style={{ height }}>
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" tickFormatter={(d) => formatDay(d, { month: "short", day: "numeric" })} tick={tick} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis width={72} domain={["auto", "auto"]} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} tick={tick} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as P | undefined;
                if (!active || !p) return null;
                return (
                  <ChartTooltip
                    title={formatDay(p.day, { weekday: "short", month: "short", day: "numeric" })}
                    rows={[
                      { label: "Balance", value: formatMoney(p.balance, currency), swatch: "var(--brand)" },
                      { label: "Pass at", value: formatMoney(p.target, currency), swatch: "var(--chart-up)" },
                      { label: "Fail below", value: formatMoney(p.floor, currency), swatch: "var(--chart-down)" },
                    ]}
                  />
                );
              }}
            />
            <Line type="stepAfter" dataKey="target" stroke="var(--chart-up)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="floor" stroke="var(--chart-down)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="balance" stroke="var(--brand)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }} animationDuration={800} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-brand" /> Balance</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-t-2 border-dashed border-chart-up" /> Profit target</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-t-2 border-dashed border-chart-down" /> Drawdown floor</span>
      </div>
    </div>
  );
}
