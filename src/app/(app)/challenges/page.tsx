import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CHALLENGE_STATUS } from "@/components/challenges/status";
import { pnlText } from "@/components/calendar/pnl-style";
import { PageHeader } from "@/components/layout/page-header";
import { Stagger, StaggerItem } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { todayIn } from "@/lib/dates";
import { getUserAccounts, requireUser } from "@/lib/session";
import { cn, formatMoney } from "@/lib/utils";
import { listChallenges } from "@/server/queries/challenges";
import { NewChallengeDialog } from "./new-challenge-dialog";

export const metadata: Metadata = { title: "Challenges" };

export default function ChallengesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
      <Challenges />
    </Suspense>
  );
}

async function Challenges() {
  const user = await requireUser();
  const [list, accounts] = await Promise.all([listChallenges(user), getUserAccounts(user.id)]);
  const dialog = (
    <NewChallengeDialog
      today={todayIn(user.timezone)}
      accounts={accounts.map((a) => ({ id: a.id, label: `${a.nickname} · #${a.login}`, balance: a.initialBalance ?? a.balance ?? null }))}
    />
  );
  return (
    <div className="grid gap-6">
      <PageHeader title="Challenges" description="Track prop-firm style evaluations: profit target, drawdown floor, daily loss and minimum days." actions={dialog} />
      {list.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
            <Trophy className="size-6" />
          </span>
          <p className="font-medium">No challenges yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Running a funded-account evaluation or a personal challenge on one of your Exness accounts? Add it to see how close you are to passing — and to the floor.
          </p>
          {dialog}
        </Card>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const r = c.result;
            const st = CHALLENGE_STATUS[r.status];
            const room = Math.max(0, Math.min(1, r.roomToFloor / c.maxDrawdown));
            return (
              <StaggerItem key={c.id}>
                <Link href={`/challenges/${c.id}`} className="group block h-full">
                  <Card className="flex h-full flex-col gap-4 p-5 transition group-hover:shadow-pop">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold tracking-tight">{c.name}</p>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="size-2 rounded-full" style={{ background: c.accountColor }} /> {c.accountName}
                        </p>
                      </div>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    <div>
                      <p className={cn("font-mono text-2xl font-semibold tabular", pnlText(r.profit))}>{formatMoney(r.profit, c.currency, { sign: true })}</p>
                      <p className="text-xs text-muted-foreground">of {formatMoney(c.profitTarget, c.currency)} target</p>
                    </div>
                    <div className="grid gap-2.5 text-xs">
                      <div className="grid gap-1">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Profit target</span>
                          <span className="font-mono tabular">{Math.round(Math.min(1, r.progress) * 100)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-chart-up" style={{ width: `${Math.min(1, r.progress) * 100}%` }} />
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Room before the floor</span>
                          <span className="font-mono tabular">{formatMoney(Math.max(0, r.roomToFloor), c.currency)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", room < 0.3 ? "bg-chart-down" : "bg-brand")} style={{ width: `${room * 100}%` }} />
                        </div>
                      </div>
                    </div>
                    <p className="mt-auto text-xs text-muted-foreground">
                      {r.tradingDays} trading days{c.minTradingDays ? ` of ${c.minTradingDays} required` : ""}
                      {r.failReason ? ` · ${r.failReason}` : ""}
                    </p>
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
