import { Card } from "@/components/ui/card";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import type { summarizeTrades } from "@/server/queries/trades";

export function TradesSummary({ summary: s }: { summary: Awaited<ReturnType<typeof summarizeTrades>> }) {
  const decided = s.wins + s.losses;
  const avgWin = s.wins ? s.grossProfit / s.wins : 0;
  const avgLoss = s.losses ? s.grossLoss / s.losses : 0;
  const items = [
    { k: "Trades", v: s.total.toLocaleString() },
    { k: "Net P&L", v: formatMoney(s.netPnl, s.currency, { sign: true }), tone: s.netPnl },
    { k: "Win rate", v: decided ? formatPercent(s.wins / decided) : "—" },
    { k: "Profit factor", v: s.grossLoss ? (s.grossProfit / Math.abs(s.grossLoss)).toFixed(2) : "—" },
    { k: "Avg win", v: s.wins ? formatMoney(avgWin, s.currency) : "—", tone: s.wins ? 1 : 0 },
    { k: "Avg loss", v: s.losses ? formatMoney(avgLoss, s.currency) : "—", tone: s.losses ? -1 : 0 },
    { k: "Avg R", v: s.avgR == null ? "—" : `${s.avgR.toFixed(2)}R` },
  ];
  return (
    <Card className="grid grid-cols-2 divide-border sm:grid-cols-4 lg:grid-cols-7 lg:divide-x">
      {items.map((i) => (
        <div key={i.k} className="px-4 py-3">
          <p className="text-xs text-muted-foreground">{i.k}</p>
          <p
            className={cn(
              "mt-0.5 font-mono text-[15px] font-semibold tabular",
              i.tone != null && i.tone > 0 && "text-profit",
              i.tone != null && i.tone < 0 && "text-loss",
            )}
          >
            {i.v}
          </p>
        </div>
      ))}
    </Card>
  );
}
