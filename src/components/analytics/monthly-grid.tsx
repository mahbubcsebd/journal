import { pnlFill, pnlText } from "@/components/calendar/pnl-style";
import { cn, formatMoney, formatTiny } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Years × months grid of net P&L with a yearly total column. */
export function MonthlyGrid({ months, currency }: { months: Map<string, number>; currency: string }) {
  const years = [...new Set([...months.keys()].map((k) => k.slice(0, 4)))].sort().reverse();
  const max = Math.max(0, ...[...months.values()].map(Math.abs));
  if (years.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No data for this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="w-14 text-left font-medium">Year</th>
            {MONTHS.map((m) => (
              <th key={m} className="font-medium">
                {m}
              </th>
            ))}
            <th className="font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => {
            const total = MONTHS.reduce((s, _, i) => s + (months.get(`${y}-${String(i + 1).padStart(2, "0")}`) ?? 0), 0);
            return (
              <tr key={y}>
                <td className="font-medium">{y}</td>
                {MONTHS.map((_, i) => {
                  const v = months.get(`${y}-${String(i + 1).padStart(2, "0")}`);
                  return (
                    <td
                      key={i}
                      title={v != null ? formatMoney(v, currency, { sign: true }) : undefined}
                      className={cn("h-10 rounded-md border text-center font-mono font-semibold tabular", v == null && "border-dashed text-muted-foreground/50", v != null && pnlText(v))}
                      style={v != null ? pnlFill(v, max) : undefined}
                    >
                      {v == null ? "·" : formatTiny(v)}
                    </td>
                  );
                })}
                <td className={cn("h-10 rounded-md border bg-card px-2 text-right font-mono font-semibold tabular", pnlText(total))}>
                  {formatMoney(total, currency, { sign: true, compact: Math.abs(total) >= 100_000 })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
