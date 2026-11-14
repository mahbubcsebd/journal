"use client";

import { AnimatedNumber } from "@/components/motion/animated-number";
import { Card } from "@/components/ui/card";
import { cn, formatMoney, formatPercent } from "@/lib/utils";

type Props = {
  label: string;
  value: number | null;
  kind: "money" | "percent" | "ratio" | "count" | "streak";
  currency?: string;
  sub?: string;
  tone?: "auto" | "none";
  hint?: string;
};

export function KpiTile({ label, value, kind, currency = "USD", sub, tone = "none", hint }: Props) {
  const fmt = (n: number) => {
    switch (kind) {
      case "money":
        return formatMoney(n, currency, { sign: tone === "auto" });
      case "percent":
        return formatPercent(n);
      case "ratio":
        return n.toFixed(2);
      case "count":
        return Math.round(n).toString();
      case "streak": {
        const r = Math.round(n);
        return r === 0 ? "0" : `${Math.abs(r)} ${r > 0 ? "green" : "red"}`;
      }
    }
  };
  return (
    <Card className="p-4 sm:p-5" title={hint}>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-xl font-semibold tracking-tight tabular sm:text-2xl",
          tone === "auto" && value != null && (value > 0 ? "text-profit" : value < 0 ? "text-loss" : ""),
        )}
      >
        {value == null ? "—" : <AnimatedNumber value={value} format={fmt} />}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}
