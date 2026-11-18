import type { Metadata } from "next";
import { Brain, Lightbulb } from "lucide-react";
import { Suspense } from "react";
import { BreakdownTable } from "@/components/analytics/breakdown-table";
import { ScoreRing } from "@/components/analytics/score-ring";
import { pnlText } from "@/components/calendar/pnl-style";
import { PageHeader } from "@/components/layout/page-header";
import { RangeTabs } from "@/components/layout/range-tabs";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/fade-in";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { disciplineScore, groupBy, summarize, tiltPatterns, type ATrade, type GroupRow } from "@/lib/analytics";
import { todayIn, type WeekStart } from "@/lib/dates";
import { MOODS } from "@/lib/journal";
import { parseRange, rangeStart } from "@/lib/ranges";
import { getSelectedAccountIds, requireUser } from "@/lib/session";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { getAnalyticsTrades, getSetupReps } from "@/server/queries/analytics";
import { MindsetCoach } from "@/components/mindset/mindset-coach";
import { getEvents, getNewsPrefs } from "@/server/queries/news";
import { DEFAULT_COOLDOWN_MINUTES } from "@/lib/mindset";
import { getJournalDays } from "@/server/queries/journal";

export const metadata: Metadata = { title: "Psychology" };

export default function PsychologyPage({ searchParams }: PageProps<"/psychology">) {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
      <Psychology searchParams={searchParams} />
    </Suspense>
  );
}

const MIN = 3; // minimum trades before a group is used for an insight

function insights(trades: ATrade[], currency: string, moodDays: { mood: number; net: number }[]) {
  const out: { tone: "good" | "bad" | "neutral"; text: string }[] = [];
  const money = (n: number) => formatMoney(n, currency, { sign: true });
  const plan = groupBy(trades, (t) => (t.followedPlan == null ? null : t.followedPlan ? "yes" : "no"));
  const yes = plan.find((r) => r.key === "yes");
  const no = plan.find((r) => r.key === "no");
  if (yes && no && yes.trades >= MIN && no.trades >= MIN) {
    const diff = yes.expectancy - no.expectancy;
    out.push({
      tone: diff > 0 ? "bad" : "neutral",
      text:
        diff > 0
          ? `Breaking your plan costs you ${formatMoney(diff, currency)} per trade on average (${money(no.expectancy)} vs ${money(yes.expectancy)} when you follow it). That's ${money(no.net)} across ${no.trades} trades.`
          : `Trades where you broke your plan did no worse (${money(no.expectancy)} vs ${money(yes.expectancy)} per trade). Your plan may need updating.`,
    });
  }
  const tilt = tiltPatterns(trades);
  if (tilt.revenge.trades >= MIN) {
    const worse = tilt.revenge.expectancy < tilt.baseline.expectancy;
    out.push({
      tone: worse ? "bad" : "neutral",
      text: `${tilt.revenge.trades} trades were opened within 30 minutes of a loss. They made ${money(tilt.revenge.net)} — ${money(tilt.revenge.expectancy)} per trade vs ${money(tilt.baseline.expectancy)} overall.${worse ? " Consider a cool-down after a losing trade." : ""}`,
    });
  }
  if (tilt.sizedUp.trades >= 1) {
    out.push({
      tone: tilt.sizedUp.net < 0 ? "bad" : "neutral",
      text: `You increased size right after a loss ${tilt.sizedUp.trades} ${tilt.sizedUp.trades === 1 ? "time" : "times"}, netting ${money(tilt.sizedUp.net)}.`,
    });
  }
  const emotions = groupBy(trades, (t) => t.emotionBefore).filter((r) => r.trades >= MIN);
  if (emotions.length >= 2) {
    const best = emotions.reduce((a, b) => (b.expectancy > a.expectancy ? b : a));
    const worst = emotions.reduce((a, b) => (b.expectancy < a.expectancy ? b : a));
    out.push({
      tone: "neutral",
      text: `You trade best when you feel "${best.key}" (${money(best.expectancy)} per trade) and worst when "${worst.key}" (${money(worst.expectancy)}).`,
    });
  }
  if (tilt.overtrading.days > 0 && tilt.overtrading.trades >= MIN) {
    out.push({
      tone: tilt.overtrading.expectancy < tilt.baseline.expectancy ? "bad" : "neutral",
      text: `On ${tilt.overtrading.days} ${tilt.overtrading.days === 1 ? "day" : "days"} you took more than twice your usual ${tilt.overtrading.medianTradesPerDay} trades. Those days averaged ${money(tilt.overtrading.expectancy)} per trade.`,
    });
  }
  const good = moodDays.filter((d) => d.mood >= 4);
  const bad = moodDays.filter((d) => d.mood <= 2);
  if (good.length >= 2 && bad.length >= 2) {
    const avg = (xs: typeof good) => xs.reduce((s, d) => s + d.net, 0) / xs.length;
    out.push({ tone: "neutral", text: `Days you rated your mood good averaged ${money(avg(good))}; bad-mood days averaged ${money(avg(bad))}.` });
  }
  const mistakes = trades.filter((t) => t.tags.some((g) => g.kind === "MISTAKE"));
  if (mistakes.length >= MIN) {
    const s = summarize("m", mistakes);
    out.push({ tone: s.net < 0 ? "bad" : "neutral", text: `Trades tagged with a mistake netted ${money(s.net)} across ${s.trades} trades.` });
  }
  return out;
}

async function Psychology({ searchParams }: { searchParams: PageProps<"/psychology">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const range = parseRange(sp.range, "90d");
  const today = todayIn(user.timezone);
  const from = rangeStart(range, today);
  const { ids } = await getSelectedAccountIds(user.id);
  const [{ trades, currency }, journal, history, setupReps] = await Promise.all([
    getAnalyticsTrades(user.id, ids, from, today, user.timezone),
    getJournalDays(user.id, from ?? "1970-01-01", today),
    // Baselines (records, averages, zones) come from all of the history.
    from ? getAnalyticsTrades(user.id, ids, undefined, today, user.timezone) : Promise.resolve(null),
    getSetupReps(user.id, ids),
  ]);
  const allTrades = history?.trades ?? trades;
  const prefs = await getNewsPrefs(user);
  const span = allTrades.length ? [Math.min(...allTrades.map((t) => t.openAt)), Math.max(...allTrades.map((t) => t.openAt))] : null;
  const newsEvents = span ? (await getEvents(new Date(span[0] - 3_600_000), new Date(span[1] + 3_600_000))).filter((e) => e.impact === "High") : [];

  const dayNet = new Map<string, number>();
  for (const t of trades) dayNet.set(t.day, (dayNet.get(t.day) ?? 0) + t.net);
  const tradingDays = [...dayNet.keys()];
  const journaledTradingDays = tradingDays.filter((d) => journal.has(d)).length;
  const discipline = disciplineScore(trades, journaledTradingDays, tradingDays.length);
  const tilt = tiltPatterns(trades);
  const moodDays = [...journal]
    .filter(([d, m]) => m != null && dayNet.has(d))
    .map(([d, m]) => ({ mood: m!, net: dayNet.get(d)! }));
  const notes = insights(trades, currency, moodDays);

  const tiltCards: { row: GroupRow; hint: string; extra?: string }[] = [
    { row: tilt.revenge, hint: "Opened within 30 min of closing a loser" },
    { row: tilt.sizedUp, hint: "Revenge trades with 20%+ more lots" },
    { row: tilt.afterStreak, hint: "Taken after two or more losses in a row" },
    { row: tilt.overtrading, hint: `Days with > ${tilt.overtrading.medianTradesPerDay * 2} trades`, extra: `${tilt.overtrading.days} days` },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Psychology"
        description="How discipline, emotions and tilt show up in your P&L."
        actions={<RangeTabs active={range} basePath="/psychology" fallback="90d" />}
      />
      <MindsetCoach
        trades={allTrades}
        setupReps={setupReps}
        currency={currency}
        cooldownMinutes={user.settings.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES}
        weekStartsOn={(user.settings.weekStartsOn ?? 1) as WeekStart}
        news={{ events: newsEvents, window: prefs.window }}
      />
      <h2 className="-mb-2 text-lg font-semibold tracking-tight">This period</h2>
      {trades.length === 0 ? (
        <Card className="px-6 py-16 text-center text-sm text-muted-foreground">No closed trades in this period.</Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <FadeIn>
              <Card className="flex h-full flex-col items-center gap-5 p-6">
                <div className="self-start">
                  <p className="text-sm font-semibold">Discipline score</p>
                  <p className="text-[13px] text-muted-foreground">Plan adherence, stop losses and journaling</p>
                </div>
                <ScoreRing score={discipline.score} />
                <div className="grid w-full gap-3">
                  {discipline.parts.map((p) => (
                    <div key={p.key} className="grid gap-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {p.key} <span className="text-muted-foreground/70">({Math.round(p.weight * 100)}%)</span>
                        </span>
                        <span className="font-mono font-medium tabular">{p.value == null ? "No data" : formatPercent(p.value, 0)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${(p.value ?? 0) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </FadeIn>
            <FadeIn delay={0.05}>
              <Card className="h-full">
                <CardHeader>
                  <div>
                    <CardTitle>What your data says</CardTitle>
                    <CardDescription>Patterns found in your trades and journal (needs at least {MIN} trades per pattern)</CardDescription>
                  </div>
                  <Lightbulb className="size-5 text-warning-ink" />
                </CardHeader>
                <CardContent>
                  {notes.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Journal more trades — feelings, plan adherence and mistakes — to unlock insights.
                    </p>
                  ) : (
                    <Stagger className="grid gap-2.5">
                      {notes.map((n, i) => (
                        <StaggerItem
                          key={i}
                          className={cn(
                            "flex gap-3 rounded-xl border p-3.5 text-sm leading-relaxed",
                            n.tone === "bad" && "border-loss/25 bg-loss-soft/50",
                          )}
                        >
                          <Brain className={cn("mt-0.5 size-4 shrink-0", n.tone === "bad" ? "text-loss" : "text-brand-ink")} />
                          {n.text}
                        </StaggerItem>
                      ))}
                    </Stagger>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold">Tilt patterns</p>
            <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {tiltCards.map(({ row, hint, extra }) => (
                <StaggerItem key={row.key}>
                  <Card className="h-full p-5">
                    <p className="text-sm font-medium">{row.key}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                    <p className={cn("mt-3 font-mono text-xl font-semibold tabular", pnlText(row.net))}>
                      {row.trades ? formatMoney(row.net, currency, { sign: true }) : "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.trades} trades{extra ? ` · ${extra}` : ""}
                      {row.winRate != null && ` · ${formatPercent(row.winRate, 0)} win rate`}
                    </p>
                    {row.trades > 0 && (
                      <p className={cn("mt-2 text-xs font-medium", pnlText(row.expectancy - tilt.baseline.expectancy))}>
                        {formatMoney(row.expectancy - tilt.baseline.expectancy, currency, { sign: true })} per trade vs your average
                      </p>
                    )}
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Feeling before the trade</CardTitle>
              </CardHeader>
              <div className="mt-4">
                <BreakdownTable rows={groupBy(trades, (t) => t.emotionBefore)} currency={currency} label="Emotion" compact />
              </div>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Plan adherence</CardTitle>
              </CardHeader>
              <div className="mt-4">
                <BreakdownTable
                  rows={groupBy(trades, (t) => (t.followedPlan == null ? "Not recorded" : t.followedPlan ? "Followed plan" : "Broke plan"), ["Followed plan", "Broke plan", "Not recorded"])}
                  currency={currency}
                  label="Plan"
                  compact
                />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Mood vs day result</CardTitle>
                <CardDescription>From the mood you set in your daily journal</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {moodDays.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Rate your mood in the daily journal to see this.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-5">
                  {MOODS.map((m) => {
                    const ds = moodDays.filter((d) => d.mood === m.value);
                    const avg = ds.length ? ds.reduce((s, d) => s + d.net, 0) / ds.length : null;
                    return (
                      <div key={m.value} className="rounded-xl border p-4 text-center">
                        <div className="text-2xl">{m.emoji}</div>
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className={cn("mt-2 font-mono text-sm font-semibold tabular", avg != null && pnlText(avg))}>
                          {avg == null ? "—" : formatMoney(avg, currency, { sign: true })}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {ds.length} {ds.length === 1 ? "day" : "days"} · avg
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
