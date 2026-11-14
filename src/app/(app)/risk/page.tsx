import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { performance } from "@/lib/analytics";
import { addDays, todayIn } from "@/lib/dates";
import { getSelectedAccountIds, getUserAccounts, requireUser } from "@/lib/session";
import { getAnalyticsTrades } from "@/server/queries/analytics";
import { RiskTools } from "./risk-tools";

export const metadata: Metadata = { title: "Risk tools" };

export default function RiskPage() {
  return (
    <>
      <PageHeader title="Risk tools" description="Size every position before you click buy or sell." />
      <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
        <Tools />
      </Suspense>
    </>
  );
}

async function Tools() {
  const user = await requireUser();
  const today = todayIn(user.timezone);
  const [accounts, { ids }] = await Promise.all([getUserAccounts(user.id), getSelectedAccountIds(user.id)]);
  const { trades } = await getAnalyticsTrades(user.id, ids, addDays(today, -89), today, user.timezone);
  const p = performance(trades);
  return (
    <RiskTools
      accounts={accounts.map((a) => ({
        id: a.id,
        label: `${a.nickname} · #${a.login}`,
        balance: a.balance ?? a.initialBalance ?? null,
        currency: a.currency,
      }))}
      winRate={p.winRate}
      tradesSample={p.trades}
    />
  );
}
