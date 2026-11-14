import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { Gauge, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { pnlText } from "@/components/calendar/pnl-style";
import { PageHeader } from "@/components/layout/page-header";
import { Stagger, StaggerItem } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { setup } from "@/db/schema";
import { groupBy } from "@/lib/analytics";
import { todayIn } from "@/lib/dates";
import { getSelectedAccountIds, requireUser } from "@/lib/session";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { createPlaybookSetup } from "@/server/actions/playbook";
import { getAnalyticsTrades } from "@/server/queries/analytics";

export const metadata: Metadata = { title: "Playbook" };

export default function PlaybookPage() {
  return (
    <>
      <PageHeader title="Playbook" description="Your setups, the rules behind them, and what each one actually earns." />
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        }
      >
        <Setups />
      </Suspense>
    </>
  );
}

async function Setups() {
  const user = await requireUser();
  const { ids } = await getSelectedAccountIds(user.id);
  const [setups, { trades, currency }] = await Promise.all([
    db.select().from(setup).where(eq(setup.userId, user.id)).orderBy(asc(setup.createdAt)),
    getAnalyticsTrades(user.id, ids, undefined, todayIn(user.timezone), user.timezone),
  ]);
  const stats = new Map(groupBy(trades, (t) => t.setupId).map((r) => [r.key, r]));

  return (
    <div className="grid gap-6">
      <form action={createPlaybookSetup} className="flex max-w-md gap-2">
        <Input name="name" placeholder="New setup, e.g. London breakout" required aria-label="New setup name" />
        <Button type="submit">
          <Plus /> Create
        </Button>
      </form>
      {setups.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <Gauge className="size-6" />
          </span>
          <p className="font-medium">No setups yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Write down each setup you trade with its rules and entry checklist, then tag trades with it to see which ones pay.
          </p>
        </Card>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {setups.map((s) => {
            const st = stats.get(s.id);
            return (
              <StaggerItem key={s.id}>
                <Link href={`/playbook/${s.id}`} className="group block h-full">
                  <Card className="relative flex h-full flex-col overflow-hidden p-5 transition group-hover:shadow-pop">
                    <div className="absolute inset-x-0 top-0 h-1" style={{ background: s.color }} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold tracking-tight">{s.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">
                          {s.description || `${s.rules.length} rules · ${s.checklist.length} checklist items`}
                        </p>
                      </div>
                      <p className={cn("font-mono text-lg font-semibold whitespace-nowrap tabular", pnlText(st?.net ?? 0))}>
                        {st ? formatMoney(st.net, currency, { sign: true }) : "—"}
                      </p>
                    </div>
                    <dl className="mt-auto grid grid-cols-4 gap-2 border-t pt-4 text-xs">
                      {[
                        ["Trades", st ? String(st.trades) : "0"],
                        ["Win rate", st?.winRate == null ? "—" : formatPercent(st.winRate, 0)],
                        ["PF", st?.profitFactor == null ? "—" : st.profitFactor.toFixed(2)],
                        ["Avg R", st?.avgR == null ? "—" : `${st.avgR.toFixed(2)}R`],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="mt-0.5 font-mono font-semibold tabular">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </Card>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
