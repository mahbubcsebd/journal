import { pnlText } from "@/components/calendar/pnl-style";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TradingAccount } from "@/db/schema";
import { cn, formatMoney, formatPrice } from "@/lib/utils";

/** Live open positions reported by the EA / MetaApi for the selected accounts. */
export function OpenPositions({ accounts, timezone }: { accounts: TradingAccount[]; timezone: string }) {
  const rows = accounts.flatMap((a) => (a.openPositions ?? []).map((p) => ({ ...p, account: a })));
  if (rows.length === 0) return null;
  const allCent = accounts.every((a) => a.currency === "USC");
  const reporting = allCent ? "USC" : "USD";
  const toReporting = (v: number, cur: string) => (cur === "USC" && !allCent ? v / 100 : v);
  const floating = rows.reduce((s, r) => s + toReporting(r.profit, r.account.currency), 0);
  const updated = accounts.map((a) => a.lastSyncAt?.getTime() ?? 0).reduce((m, t) => Math.max(m, t), 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-brand" />
            </span>
            Open positions
          </CardTitle>
          <CardDescription>
            {rows.length} open · updated{" "}
            {updated ? new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(updated) : "—"}
          </CardDescription>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Floating P&amp;L</p>
          <p className={cn("font-mono text-lg font-semibold tabular", pnlText(floating))}>{formatMoney(floating, reporting, { sign: true })}</p>
        </div>
      </CardHeader>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 pl-5 font-medium">Symbol</th>
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 text-right font-medium">Lots</th>
              <th className="px-3 py-2 text-right font-medium">Open → now</th>
              <th className="px-3 py-2 text-right font-medium">SL / TP</th>
              <th className="py-2 pr-5 pl-3 text-right font-medium">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.account.id}-${r.ticket}`} className="border-b last:border-0">
                <td className="py-2.5 pr-3 pl-5">
                  <span className="mr-2 font-medium">{r.symbol}</span>
                  <Badge variant={r.side === "LONG" ? "profit" : "loss"}>{r.side === "LONG" ? "Long" : "Short"}</Badge>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: r.account.color }} />
                    {r.account.nickname}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular">{r.volume.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] text-muted-foreground tabular">
                  {formatPrice(r.openPrice)} → {formatPrice(r.currentPrice)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] text-muted-foreground tabular">
                  {r.sl ? formatPrice(r.sl) : "—"} / {r.tp ? formatPrice(r.tp) : "—"}
                </td>
                <td className={cn("py-2.5 pr-5 pl-3 text-right font-mono font-semibold tabular", pnlText(r.profit))}>
                  {formatMoney(r.profit, r.account.currency, { sign: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
