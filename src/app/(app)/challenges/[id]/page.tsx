import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CHALLENGE_STATUS } from "@/components/challenges/status";
import { pnlText } from "@/components/calendar/pnl-style";
import { ChallengeChart } from "@/components/charts/challenge-chart";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { cn, formatMoney } from "@/lib/utils";
import { getChallenge } from "@/server/queries/challenges";
import { DeleteChallenge } from "./delete-challenge";

export const metadata: Metadata = { title: "Challenge" };

export default function ChallengePage({ params }: PageProps<"/challenges/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] rounded-xl" />}>
      <ChallengeView params={params} />
    </Suspense>
  );
}

async function ChallengeView({ params }: { params: PageProps<"/challenges/[id]">["params"] }) {
  const [user, { id }] = await Promise.all([requireUser(), params]);
  const c = await getChallenge(user, id);
  if (!c) notFound();
  const r = c.result;
  const st = CHALLENGE_STATUS[r.status];
  const cur = c.currency;
  const rules = [
    { label: "Profit target", value: formatMoney(c.profitTarget, cur), ok: r.profit >= c.profitTarget, detail: `${formatMoney(r.profit, cur, { sign: true })} so far` },
    {
      label: `Max drawdown (${c.trailingDrawdown ? "trailing" : "static"})`,
      value: formatMoney(c.maxDrawdown, cur),
      ok: r.failReason !== "Max drawdown",
      detail: `Floor ${formatMoney(r.floor, cur)} · ${formatMoney(Math.max(0, r.roomToFloor), cur)} room`,
    },
    ...(c.maxDailyDrawdown != null
      ? [
          {
            label: "Max daily loss",
            value: formatMoney(c.maxDailyDrawdown, cur),
            ok: r.failReason !== "Daily loss limit",
            detail: r.worstDay ? `Worst day ${formatMoney(r.worstDay.net, cur, { sign: true })} (${formatDay(r.worstDay.day, { month: "short", day: "numeric" })})` : "No trading days yet",
          },
        ]
      : []),
    ...(c.minTradingDays
      ? [{ label: "Minimum trading days", value: String(c.minTradingDays), ok: r.daysNeeded === 0, detail: `${r.tradingDays} traded${r.daysNeeded ? ` · ${r.daysNeeded} to go` : ""}` }]
      : []),
  ];

  return (
    <div className="grid gap-6">
      <Link href="/challenges" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Challenges
      </Link>
      <FadeIn className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: c.accountColor }} /> {c.accountName} · started {formatDay(c.startDate, { month: "short", day: "numeric", year: "numeric" })}
            {c.endDate && ` · ends ${formatDay(c.endDate, { month: "short", day: "numeric", year: "numeric" })}`}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("font-mono text-3xl font-semibold tracking-tight tabular", pnlText(r.profit))}>{formatMoney(r.profit, cur, { sign: true })}</p>
          <p className="text-xs text-muted-foreground">Balance {formatMoney(r.balance, cur)}</p>
        </div>
      </FadeIn>

      {(r.status === "FAILED" || r.status === "PASSED") && (
        <div className={cn("rounded-xl border px-4 py-3 text-sm", r.status === "FAILED" ? "border-loss/30 bg-loss-soft" : "border-profit/30 bg-profit-soft")}>
          {r.status === "FAILED"
            ? `Failed on ${formatDay(r.failedOn!, { month: "long", day: "numeric" })}: ${r.failReason?.toLowerCase()} broken. Later days aren't counted.`
            : `Passed on ${formatDay(r.passedOn!, { month: "long", day: "numeric" })} 🎉 Later days aren't counted.`}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Balance</CardTitle>
              <CardDescription>Closed P&amp;L at the end of each trading day</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ChallengeChart data={r.curve} currency={cur} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
          </CardHeader>
          <ul className="grid gap-2 p-5">
            {rules.map((x) => (
              <li key={x.label} className="flex items-start gap-3 rounded-xl border p-3">
                <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white", x.ok ? "bg-chart-up" : "bg-chart-down")}>
                  {x.ok ? "✓" : "✗"}
                </span>
                <div className="grid gap-0.5">
                  <p className="text-sm font-medium">
                    {x.label} <span className="font-mono text-muted-foreground tabular">{x.value}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{x.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="px-5 pb-4 text-[11px] text-muted-foreground">
            Limits are checked on closed trades at day end. Your broker or prop firm may also count open (floating) losses during the day.
          </p>
          <div className="flex justify-end border-t px-5 py-3">
            <DeleteChallenge id={c.id} />
          </div>
        </Card>
      </div>
    </div>
  );
}
