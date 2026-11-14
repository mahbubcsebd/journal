import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { parseTradeFilters } from "@/lib/trade-filters";
import { getSelectedAccountIds, requireUser } from "@/lib/session";
import { getFilterOptions, listTrades, PAGE_SIZE, summarizeTrades } from "@/server/queries/trades";
import { TradeFiltersBar } from "./trade-filters";
import { TradesSummary } from "./trades-summary";
import { TradesTable } from "./trades-table";

export const metadata: Metadata = { title: "Trades" };

export default function TradesPage({ searchParams }: PageProps<"/trades">) {
  return (
    <>
      <PageHeader
        title="Trades"
        description="Every position from the accounts selected above."
        actions={
          <Button asChild>
            <Link href="/trades/new">
              <Plus /> Add trade
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<TradesSkeleton />}>
        <TradesView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function TradesSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-11 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

async function TradesView({ searchParams }: { searchParams: PageProps<"/trades">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const filters = parseTradeFilters(sp);
  const { ids } = await getSelectedAccountIds(user.id);
  const [rows, summary, options] = await Promise.all([
    listTrades(user.id, ids, filters, user.timezone),
    summarizeTrades(user.id, ids, filters, user.timezone),
    getFilterOptions(user.id),
  ]);

  return (
    <div className="grid gap-4">
      <TradeFiltersBar filters={filters} options={options} />
      <TradesSummary summary={summary} />
      <TradesTable
        rows={rows}
        filters={filters}
        timezone={user.timezone}
        total={summary.total}
        pageSize={PAGE_SIZE}
        hasAccounts={ids.length > 0}
      />
    </div>
  );
}
