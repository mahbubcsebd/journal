import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { pnlText } from "@/components/calendar/pnl-style";
import { EquityChart } from "@/components/charts/equity-chart";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { setup } from "@/db/schema";
import { performance } from "@/lib/analytics";
import { formatDay, todayIn } from "@/lib/dates";
import { equityCurve } from "@/lib/stats";
import { getSelectedAccountIds, requireUser } from "@/lib/session";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { getAnalyticsTrades } from "@/server/queries/analytics";
import { SetupEditor } from "./setup-editor";

export const metadata: Metadata = { title: "Setup" };

export default function SetupPage({ params }: PageProps<"/playbook/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
      <SetupView params={params} />
    </Suspense>
  );
}

async function SetupView({ params }: { params: PageProps<"/playbook/[id]">["params"] }) {
  const [user, { id }] = await Promise.all([requireUser(), params]);
  const [s] = await db.select().from(setup).where(and(eq(setup.id, id), eq(setup.userId, user.id))).limit(1);
  if (!s) notFound();
  const { ids } = await getSelectedAccountIds(user.id);
  const { trades, currency } = await getAnalyticsTrades(user.id, ids, undefined, todayIn(user.timezone), user.timezone, { setupId: s.id });
  const p = performance(trades);
  const byDay = new Map<string, { day: string; net: number; trades: number; wins: number; losses: number }>();
  for (const t of trades) {
    const d = byDay.get(t.day) ?? { day: t.day, net: 0, trades: 0, wins: 0, losses: 0 };
    d.net += t.net;
    d.trades++;
    byDay.set(t.day, d);
  }
  const curve = equityCurve([...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)));
  const recent = [...trades].reverse().slice(0, 8);

  return (
    <div className="grid gap-6">
      <Link href="/playbook" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Playbook
      </Link>
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_440px]">
        <SetupEditor
          setup={{ id: s.id, name: s.name, description: s.description, color: s.color, rules: s.rules, checklist: s.checklist }}
        />
        <FadeIn delay={0.1} className="grid gap-6">
          <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border">
            {[
              ["Net P&L", formatMoney(p.net, currency, { sign: true }), p.net],
              ["Trades", String(p.trades)],
              ["Win rate", p.winRate == null ? "—" : formatPercent(p.winRate)],
              ["Profit factor", p.profitFactor == null ? "—" : p.profitFactor.toFixed(2)],
              ["Expectancy", formatMoney(p.expectancy, currency, { sign: true }), p.expectancy],
              ["Average R", p.avgR == null ? "—" : `${p.avgR.toFixed(2)}R`],
            ].map(([k, v, tone]) => (
              <div key={k as string} className="bg-card px-4 py-3.5">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className={cn("mt-0.5 font-mono text-[15px] font-semibold tabular", tone != null && pnlText(tone as number))}>{v}</p>
              </div>
            ))}
          </Card>
          {curve.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Equity on this setup</CardTitle>
              </CardHeader>
              <CardContent>
                <EquityChart data={curve} currency={currency} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Recent trades</CardTitle>
            </CardHeader>
            <ul className="grid gap-0.5 p-2">
              {recent.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Tag trades with this setup from a trade&apos;s journal panel.
                </li>
              )}
              {recent.map((t) => (
                <li key={t.id}>
                  <Link href={`/trades/${t.id}`} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-accent">
                    <span className="w-14 text-xs text-muted-foreground tabular">{formatDay(t.day, { month: "short", day: "numeric" })}</span>
                    <span className="font-medium">{t.symbol}</span>
                    <Badge variant={t.side === "LONG" ? "profit" : "loss"}>{t.side === "LONG" ? "Long" : "Short"}</Badge>
                    <span className={cn("ml-auto font-mono font-semibold tabular", pnlText(t.net))}>{formatMoney(t.net, currency, { sign: true })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
