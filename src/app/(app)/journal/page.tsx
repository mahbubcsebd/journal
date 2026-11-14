import type { Metadata } from "next";
import { NotebookPen, PenLine } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { pnlText } from "@/components/calendar/pnl-style";
import { PageHeader } from "@/components/layout/page-header";
import { Stagger, StaggerItem } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, formatDay, todayIn } from "@/lib/dates";
import { docToText } from "@/lib/doc";
import { BIAS, moodEmoji } from "@/lib/journal";
import { getSelectedAccountIds, requireUser } from "@/lib/session";
import { cn, formatMoney } from "@/lib/utils";
import { getDayNets, listJournalEntries } from "@/server/queries/journal";

export const metadata: Metadata = { title: "Daily journal" };

export default function JournalPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] rounded-xl" />}>
      <JournalList />
    </Suspense>
  );
}

async function JournalList() {
  const user = await requireUser();
  const today = todayIn(user.timezone);
  const { ids } = await getSelectedAccountIds(user.id);
  const entries = await listJournalEntries(user.id, 90);
  const from = addDays(today, -60);
  const oldest = entries.at(-1)?.day ?? today;
  const { currency, nets } = await getDayNets(ids, oldest < from ? oldest : from, today);
  const journaled = new Set(entries.map((e) => e.day));

  // Trading days in the last 60 days that still have no journal entry.
  const missing = [...nets.keys()].filter((d) => d >= from && !journaled.has(d)).sort().reverse().slice(0, 8);

  // Current streak of consecutive trading days that were journaled.
  const tradingDays = [...nets.keys()].sort().reverse();
  let streak = 0;
  for (const d of tradingDays) {
    if (journaled.has(d)) streak++;
    else break;
  }
  const last30 = tradingDays.filter((d) => d >= addDays(today, -29));
  const coverage = last30.length ? last30.filter((d) => journaled.has(d)).length / last30.length : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Daily journal"
        description="Plan before the session, review after it. Your day's trades are attached automatically."
        actions={
          <Button asChild>
            <Link href={`/journal/${today}`}>
              <PenLine /> {journaled.has(today) ? "Open today" : "Start today's entry"}
            </Link>
          </Button>
        }
      />

      <Card className="grid grid-cols-3 gap-px overflow-hidden bg-border">
        {[
          ["Entries", String(entries.length)],
          ["Journaling streak", `${streak} trading ${streak === 1 ? "day" : "days"}`],
          ["Last 30 days covered", coverage == null ? "—" : `${Math.round(coverage * 100)}%`],
        ].map(([k, v]) => (
          <div key={k} className="bg-card px-4 py-3.5">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold tabular">{v}</p>
          </div>
        ))}
      </Card>

      {missing.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Trading days waiting for a review</p>
          <div className="flex flex-wrap gap-2">
            {missing.map((d) => {
              const n = nets.get(d)!;
              return (
                <Link
                  key={d}
                  href={`/journal/${d}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-dashed bg-card px-3 py-1.5 text-sm transition hover:border-solid hover:shadow-soft"
                >
                  {formatDay(d, { weekday: "short", month: "short", day: "numeric" })}
                  <span className={cn("font-mono text-xs font-semibold tabular", pnlText(n.net))}>
                    {formatMoney(n.net, currency, { sign: true })}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
            <NotebookPen className="size-6" />
          </span>
          <p className="font-medium">No journal entries yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Write a quick plan before you trade and a review after. Over time, this is where your edge becomes obvious.
          </p>
        </Card>
      ) : (
        <Stagger className="grid gap-3">
          {entries.map((e) => {
            const n = nets.get(e.day);
            const plan = docToText(e.premarket?.plan, 160);
            const review = docToText(e.review?.wentWell, 80) || docToText(e.review?.improve, 80) || docToText(e.review?.lessons, 80);
            const bias = BIAS.find((b) => b.value === e.premarket?.bias);
            const checks = Object.values(e.premarket?.checklist ?? {});
            return (
              <StaggerItem key={e.id}>
                <Link href={`/journal/${e.day}`} className="group block">
                  <Card className="flex gap-4 p-4 transition group-hover:shadow-pop sm:p-5">
                    <div className="flex w-14 shrink-0 flex-col items-center rounded-xl border bg-muted/40 py-2 text-center">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase">{formatDay(e.day, { month: "short" })}</span>
                      <span className="text-xl leading-tight font-semibold tabular">{Number(e.day.slice(8))}</span>
                      <span className="text-[11px] text-muted-foreground">{formatDay(e.day, { weekday: "short" })}</span>
                    </div>
                    <div className="grid min-w-0 flex-1 content-start gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {moodEmoji(e.mood) && <span className="text-lg leading-none" aria-label="Mood">{moodEmoji(e.mood)}</span>}
                        {bias && <Badge variant={bias.value === "BULLISH" ? "profit" : bias.value === "BEARISH" ? "loss" : "default"}>{bias.label}</Badge>}
                        {checks.length > 0 && (
                          <Badge variant="outline">
                            Checklist {checks.filter(Boolean).length}/{checks.length}
                          </Badge>
                        )}
                        {n ? (
                          <span className={cn("ml-auto font-mono text-sm font-semibold tabular", pnlText(n.net))}>
                            {formatMoney(n.net, currency, { sign: true })} · {n.trades} trades
                          </span>
                        ) : (
                          <span className="ml-auto text-xs text-muted-foreground">No trades</span>
                        )}
                      </div>
                      {plan && <p className="line-clamp-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Plan:</span> {plan}</p>}
                      {review && <p className="line-clamp-1 text-sm text-muted-foreground"><span className="font-medium text-foreground">Review:</span> {review}</p>}
                      {!plan && !review && <p className="text-sm text-muted-foreground/70 italic">Empty entry</p>}
                    </div>
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
