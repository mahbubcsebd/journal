import { pnlText } from "@/components/calendar/pnl-style";
import type { GroupRow } from "@/lib/analytics";
import { cn, formatMoney, formatPercent } from "@/lib/utils";

/** Category table with an inline diverging bar for net P&L. */
export function BreakdownTable({
  rows,
  currency,
  label,
  extra,
  hideEmpty = true,
  compact = false,
}: {
  rows: GroupRow[];
  currency: string;
  label: string;
  extra?: { header: string; cell: (r: GroupRow) => React.ReactNode };
  hideEmpty?: boolean;
  /** For half-width cards: drop profit factor, expectancy, avg R and the bar. */
  compact?: boolean;
}) {
  const list = hideEmpty ? rows.filter((r) => r.trades > 0) : rows;
  const max = Math.max(1, ...list.map((r) => Math.abs(r.net)));
  if (list.length === 0) return <p className="px-5 py-8 text-center text-sm text-muted-foreground">No data for this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm", compact ? "min-w-[360px]" : "min-w-[620px]")}>
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 pl-5 font-medium">{label}</th>
            <th className="px-3 py-2 text-right font-medium">Trades</th>
            <th className="px-3 py-2 text-right font-medium">Win rate</th>
            {!compact && (<th className="px-3 py-2 text-right font-medium">Profit factor</th>)}
            {!compact && (<th className="px-3 py-2 text-right font-medium">Expectancy</th>)}
            {!compact && (<th className="px-3 py-2 text-right font-medium">Avg R</th>)}
            {extra && <th className="px-3 py-2 text-right font-medium">{extra.header}</th>}
            <th className={cn("py-2 pr-5 pl-3 text-right font-medium", !compact && "w-[34%]")}>Net P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.key} className="border-b last:border-0">
              <td className="py-2.5 pr-3 pl-5 font-medium">{r.key}</td>
              <td className="px-3 py-2.5 text-right tabular">{r.trades}</td>
              <td className="px-3 py-2.5 text-right tabular">{r.winRate == null ? "—" : formatPercent(r.winRate, 0)}</td>
              {!compact && (
                <>
                  <td className="px-3 py-2.5 text-right tabular">{r.profitFactor == null ? (r.grossProfit > 0 ? "∞" : "—") : r.profitFactor.toFixed(2)}</td>
                  <td className={cn("px-3 py-2.5 text-right font-mono tabular", pnlText(r.expectancy))}>
                    {formatMoney(r.expectancy, currency, { sign: true })}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">{r.avgR == null ? "—" : `${r.avgR.toFixed(2)}R`}</td>
                </>
              )}
              {extra && <td className="px-3 py-2.5 text-right tabular">{extra.cell(r)}</td>}
              <td className="py-2.5 pr-5 pl-3">
                <div className="flex items-center justify-end gap-3">
                  <div className={cn("relative hidden h-1.5 flex-1 rounded-full bg-muted", !compact && "sm:block")}>
                    <div
                      className="absolute inset-y-0 rounded-full"
                      style={{
                        width: `${(Math.abs(r.net) / max) * 50}%`,
                        left: r.net >= 0 ? "50%" : `${50 - (Math.abs(r.net) / max) * 50}%`,
                        background: r.net >= 0 ? "var(--chart-up)" : "var(--chart-down)",
                      }}
                    />
                    <div className="absolute inset-y-[-3px] left-1/2 w-px bg-muted-foreground/40" />
                  </div>
                  <span className={cn("w-28 text-right font-mono font-semibold tabular", pnlText(r.net))}>
                    {formatMoney(r.net, currency, { sign: true })}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
