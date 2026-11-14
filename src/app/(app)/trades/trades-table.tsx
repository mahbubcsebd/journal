"use client";

import { motion } from "motion/react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FolderInput, ListOrdered } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/trading/metrics";
import { filtersToQuery, type TradeFilters } from "@/lib/trade-filters";
import { cn, formatDateTime, formatMoney, formatPrice } from "@/lib/utils";
import type { TradeRow } from "@/server/queries/trades";

type Props = {
  rows: TradeRow[];
  filters: TradeFilters;
  timezone: string;
  total: number;
  pageSize: number;
  hasAccounts: boolean;
};

function SortHead({
  label,
  sort,
  filters,
  className,
}: {
  label: string;
  sort: TradeFilters["sort"];
  filters: TradeFilters;
  className?: string;
}) {
  const active = filters.sort === sort;
  const dir = active && filters.dir === "desc" ? "asc" : "desc";
  const q = filtersToQuery({ ...filters, sort, dir, page: 1 });
  return (
    <th className={cn("px-3 py-2.5 font-medium", className)}>
      <Link href={`/trades${q ? `?${q}` : ""}`} scroll={false} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {active && (filters.dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </Link>
    </th>
  );
}

export function TradesTable({ rows, filters, timezone, total, pageSize, hasAccounts }: Props) {
  const router = useRouter();
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
          <ListOrdered className="size-6" />
        </span>
        <p className="font-medium">{total === 0 && filters.page === 1 ? "No trades yet" : "No trades on this page"}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasAccounts
            ? "Import your MT5 history or add a trade manually. If you set filters, try clearing them."
            : "Add an Exness account first, then import its history."}
        </p>
        <div className="mt-2 flex gap-2">
          <Button asChild size="sm">
            <Link href={hasAccounts ? "/import" : "/accounts"}>
              <FolderInput /> {hasAccounts ? "Import history" : "Add account"}
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  const pageHref = (page: number) => {
    const q = filtersToQuery({ ...filters, page });
    return `/trades${q ? `?${q}` : ""}`;
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <SortHead label="Date" sort="date" filters={filters} className="pl-5" />
              <th className="px-3 py-2.5 font-medium">Symbol</th>
              <th className="px-3 py-2.5 font-medium">Account</th>
              <SortHead label="Size" sort="volume" filters={filters} className="text-right" />
              <th className="px-3 py-2.5 text-right font-medium">Entry → Exit</th>
              <th className="px-3 py-2.5 text-right font-medium">Pips</th>
              <SortHead label="R" sort="r" filters={filters} className="text-right" />
              <SortHead label="Duration" sort="duration" filters={filters} className="text-right" />
              <th className="px-3 py-2.5 font-medium">Tags</th>
              <SortHead label="Net P&L" sort="pnl" filters={filters} className="pr-5 text-right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <motion.tr
                key={t.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i, 20) * 0.012 }}
                onClick={() => router.push(`/trades/${t.id}`)}
                className="group cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/50"
              >
                <td className="py-2.5 pr-3 pl-5 whitespace-nowrap">
                  <Link href={`/trades/${t.id}`} className="tabular" onClick={(e) => e.stopPropagation()}>
                    {formatDateTime(t.closeTime ?? t.openTime, timezone)}
                  </Link>
                  {t.status === "OPEN" && (
                    <Badge variant="warning" className="ml-2">
                      Open
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.symbol}</span>
                    <Badge variant={t.side === "LONG" ? "profit" : "loss"}>{t.side === "LONG" ? "Long" : "Short"}</Badge>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex max-w-[140px] items-center gap-1.5 truncate text-muted-foreground">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: t.accountColor }} />
                    {t.accountName}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular">{t.volume.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] whitespace-nowrap text-muted-foreground tabular">
                  {formatPrice(t.openPrice)} → {formatPrice(t.closePrice)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5 text-right font-mono tabular",
                    t.pips != null && (t.pips > 0 ? "text-profit" : t.pips < 0 ? "text-loss" : ""),
                  )}
                >
                  {t.pips == null ? "—" : t.pips.toFixed(1)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular">{t.rMultiple == null ? "—" : `${t.rMultiple.toFixed(2)}R`}</td>
                <td className="px-3 py-2.5 text-right text-muted-foreground tabular">{formatDuration(t.durationSec)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex max-w-[180px] flex-wrap gap-1">
                    {t.setupName && <Badge variant="brand">{t.setupName}</Badge>}
                    {t.tags.slice(0, 3).map((g) => (
                      <span
                        key={g.id}
                        className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                        style={{ background: `color-mix(in oklch, ${g.color} 16%, transparent)`, color: `color-mix(in oklch, ${g.color} 55%, var(--foreground))` }}
                      >
                        {g.name}
                      </span>
                    ))}
                    {t.tags.length > 3 && <span className="text-[11px] text-muted-foreground">+{t.tags.length - 3}</span>}
                  </div>
                </td>
                <td
                  className={cn(
                    "py-2.5 pr-5 pl-3 text-right font-mono font-semibold whitespace-nowrap tabular",
                    t.status === "OPEN" ? "text-muted-foreground" : t.netPnl > 0 ? "text-profit" : t.netPnl < 0 ? "text-loss" : "",
                  )}
                >
                  {formatMoney(t.netPnl, t.currency, { sign: true })}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t px-5 py-3 text-[13px] text-muted-foreground">
        <span className="tabular">
          {(filters.page - 1) * pageSize + 1}–{Math.min(filters.page * pageSize, total)} of {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-1">
          <Button asChild={filters.page > 1} variant="ghost" size="icon-sm" disabled={filters.page <= 1} aria-label="Previous page">
            {filters.page > 1 ? (
              <Link href={pageHref(filters.page - 1)} scroll={false}>
                <ChevronLeft />
              </Link>
            ) : (
              <ChevronLeft />
            )}
          </Button>
          <span className="px-2 tabular">
            {filters.page} / {pages}
          </span>
          <Button asChild={filters.page < pages} variant="ghost" size="icon-sm" disabled={filters.page >= pages} aria-label="Next page">
            {filters.page < pages ? (
              <Link href={pageHref(filters.page + 1)} scroll={false}>
                <ChevronRight />
              </Link>
            ) : (
              <ChevronRight />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
