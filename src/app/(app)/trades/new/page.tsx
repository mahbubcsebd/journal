import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserAccounts, requireUser } from "@/lib/session";
import { ManualTradeForm } from "./manual-trade-form";

export const metadata: Metadata = { title: "Add trade" };

export default function NewTradePage() {
  return (
    <div className="max-w-3xl">
      <Link href="/trades" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Trades
      </Link>
      <PageHeader
        title="Add a trade"
        description="For trades outside MT5, backtests, or anything the sync missed. Times are in your timezone."
      />
      <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const user = await requireUser();
  const accounts = await getUserAccounts(user.id);
  return (
    <ManualTradeForm
      timezone={user.timezone}
      accounts={accounts.map((a) => ({ id: a.id, label: `${a.nickname} · #${a.login}`, currency: a.currency }))}
    />
  );
}
