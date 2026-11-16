import { CalendarClock, Gauge, Hourglass, ListChecks, ShieldAlert, Trophy } from "lucide-react";
import Link from "next/link";
import { pnlFill, pnlText } from "@/components/calendar/pnl-style";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ATrade } from "@/lib/analytics";
import { weekdayLabels, type WeekStart } from "@/lib/dates";
import {
  checklistAdherence,
  CONFIDENCE_TRADES,
  formatDuration,
  heatmap,
  holdTimes,
  revengeTrades,
  setupConfidence,
  streakCheck,
  ZONE_MIN_TRADES,
  type SetupRep,
} from "@/lib/mindset";
import { cn, formatMoney, formatPercent } from "@/lib/utils";

type Props = {
  /** All-time closed live trades: the baselines come from the full history. */
  trades: ATrade[];
  setupReps: SetupRep[];
  currency: string;
  cooldownMinutes: number;
  weekStartsOn: WeekStart;
};

function Coach({
  icon: Icon,
  problem,
  title,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  problem: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-4 p-5", className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{problem}</p>
          <h3 className="font-semibold tracking-tight">{title}</h3>
        </div>
      </div>
      {children}
    </Card>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

/** Current run vs the record, as a bar. */
function RunBar({ label, current, record, tone }: { label: string; current: number; record: number; tone: "profit" | "loss" }) {
  const pct = record ? Math.min(100, (current / record) * 100) : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular">
          <b className={tone === "profit" ? "text-profit" : "text-loss"}>{current}</b>
          <span className="text-muted-foreground"> / record {record}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone === "profit" ? "bg-chart-up" : "bg-chart-down")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function MindsetCoach({ trades, setupReps, currency, cooldownMinutes, weekStartsOn }: Props) {
  const money = (n: number) => formatMoney(n, currency, { sign: true });
  const streak = streakCheck(trades);
  const hold = holdTimes(trades);
  const heat = heatmap(trades);
  const window = cooldownMinutes || 30;
  const revenge = revengeTrades(trades, window);
  const revengeIds = new Set(revenge.map((t) => t.id));
  const others = trades.filter((t) => !revengeIds.has(t.id));
  const exp = (ts: ATrade[]) => (ts.length ? ts.reduce((s, t) => s + t.net, 0) / ts.length : 0);
  const confidence = setupConfidence(setupReps);
  const checklist = checklistAdherence(trades.map((t) => ({ ...t, checklist: t.checklist ?? null })));
  const dayOrder = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
  const dayNames = weekdayLabels(0);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const zoneLabel = (z: { weekday: number; hour: number }) => `${dayNames[z.weekday]} ${String(z.hour).padStart(2, "0")}:00`;
  const enough = trades.length >= 10;

  return (
    <section className="grid gap-4" aria-labelledby="coach-title">
      <div>
        <h2 id="coach-title" className="text-lg font-semibold tracking-tight">
          Mindset coach
        </h2>
        <p className="text-sm text-muted-foreground">
          Your own history, all time, turned into baselines — so streaks, hold times and trading hours feel normal instead of scary.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 2 & 5 — streaks */}
        <Coach icon={Trophy} problem="Fear in a losing streak · doubt in a winning one" title="Streak reality check">
          {streak.decided < 10 ? (
            <Empty>Needs at least 10 closed trades with a result.</Empty>
          ) : (
            <>
              <div className="grid gap-3">
                <RunBar label="Losses in a row" current={streak.current.kind === "loss" ? streak.current.count : 0} record={streak.maxLosses} tone="loss" />
                <RunBar label="Wins in a row" current={streak.current.kind === "win" ? streak.current.count : 0} record={streak.maxWins} tone="profit" />
              </div>
              <p className="text-sm leading-relaxed">
                {streak.current.kind === "loss" ? (
                  <>
                    You&apos;re on <b>{streak.current.count === 1 ? "1 loss" : `${streak.current.count} losses`}</b> in a row; your record is <b>{streak.maxLosses}</b>. With a{" "}
                    <b>{formatPercent(streak.winRate ?? 0, 0)}</b> win rate, about <b>{streak.lossesPer10}</b> of every 10 trades lose
                    {streak.runEvery ? (
                      <>
                        {" "}
                        and a run like this shows up about once every <b>{streak.runEvery}</b> trades
                      </>
                    ) : null}
                    . This is normal variance —{" "}
                    {streak.current.count >= streak.maxLosses ? "but it's your longest ever: cut size and review before the next trade." : "stick to the plan."}
                  </>
                ) : streak.current.kind === "win" ? (
                  <>
                    You&apos;re on <b>{streak.current.count === 1 ? "1 win" : `${streak.current.count} wins`}</b> in a row; your record is <b>{streak.maxWins}</b>. A loss isn&apos;t
                    &quot;due&quot; — each trade is independent. Keep the same size and the same rules.
                  </>
                ) : (
                  <>
                    Win rate <b>{formatPercent(streak.winRate ?? 0, 0)}</b>: expect about <b>{streak.lossesPer10}</b> losses in every 10 trades. Your
                    longest losing run is <b>{streak.maxLosses}</b>, your longest winning run <b>{streak.maxWins}</b>.
                  </>
                )}
              </p>
            </>
          )}
        </Coach>

        {/* 4 — hold time */}
        <Coach icon={Hourglass} problem="Closing winners too early" title="Hold-time benchmark">
          {hold.winners < 5 || hold.losers < 5 ? (
            <Empty>Needs at least 5 winners and 5 losers.</Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-profit-soft/40 p-3">
                  <p className="text-xs text-muted-foreground">Winners take</p>
                  <p className="font-mono text-xl font-semibold text-profit tabular">{formatDuration(hold.avgWinSec)}</p>
                  <p className="text-[11px] text-muted-foreground">median {formatDuration(hold.medianWinSec)}</p>
                </div>
                <div className="rounded-xl border bg-loss-soft/40 p-3">
                  <p className="text-xs text-muted-foreground">Losers take</p>
                  <p className="font-mono text-xl font-semibold text-loss tabular">{formatDuration(hold.avgLossSec)}</p>
                  <p className="text-[11px] text-muted-foreground">median {formatDuration(hold.medianLossSec)}</p>
                </div>
              </div>
              <ul className="grid gap-1.5 text-sm leading-relaxed">
                <li>
                  Give a trade about <b>{formatDuration(hold.avgWinSec)}</b> to work — that&apos;s how long your winners usually need. The dashboard
                  timer on open positions shows where you are.
                </li>
                {hold.earlyWinShare != null && hold.earlyWinShare >= 0.3 && (
                  <li>
                    <b>{formatPercent(hold.earlyWinShare, 0)}</b> of your winners were closed in under half that time — possibly cut short.
                  </li>
                )}
                {hold.holdsLosersLonger && <li className="text-loss">You hold losers longer than winners. Let the stop loss do its job.</li>}
              </ul>
            </>
          )}
        </Coach>

        {/* 3 — revenge & cooldown */}
        <Coach icon={ShieldAlert} problem="Revenge trading after a loss" title="Cooldown & revenge trades">
          {!enough ? (
            <Empty>Needs at least 10 closed trades.</Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Within {window} min of a loss</p>
                  <p className="font-mono text-xl font-semibold tabular">{revenge.length}</p>
                  <p className={cn("text-[11px] tabular", pnlText(exp(revenge)))}>{revenge.length ? `${money(exp(revenge))} / trade` : "none"}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">All other trades</p>
                  <p className="font-mono text-xl font-semibold tabular">{others.length}</p>
                  <p className={cn("text-[11px] tabular", pnlText(exp(others)))}>{money(exp(others))} / trade</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed">
                {revenge.length >= 3 && exp(revenge) < exp(others)
                  ? `Trades right after a loss earn ${formatMoney(exp(others) - exp(revenge), currency)} less per trade. The cooldown banner will remind you to step away.`
                  : revenge.length
                    ? "Trades after a loss aren't hurting you so far — keep the cooldown as a safety net."
                    : "No revenge trades. Nice discipline."}{" "}
                <span className="text-muted-foreground">
                  Cooldown: {cooldownMinutes ? `${cooldownMinutes} min` : "off"} ·{" "}
                  <Link href="/settings" className="text-brand-ink hover:underline">
                    change
                  </Link>
                </span>
              </p>
            </>
          )}
        </Coach>

        {/* 1 — setup confidence */}
        <Coach icon={Gauge} problem="Hesitating to enter a valid setup" title="Setup confidence">
          {confidence.length === 0 ? (
            <Empty>
              Tag trades (and backtests) with a{" "}
              <Link href="/playbook" className="text-brand-ink hover:underline">
                playbook setup
              </Link>{" "}
              to build a confidence score. {CONFIDENCE_TRADES} reps make a setup automatic.
            </Empty>
          ) : (
            <ul className="grid gap-3">
              {confidence.slice(0, 5).map((s) => (
                <li key={s.setupId} className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/playbook/${s.setupId}`} className="truncate font-medium hover:underline">
                      {s.name}
                    </Link>
                    <Badge variant={s.level === "confident" ? "profit" : s.level === "building" ? "warning" : "default"}>
                      {s.score} · {s.level === "confident" ? "Confident" : s.level === "building" ? "Building" : "Practice"}
                    </Badge>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${s.score}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground tabular">
                    {s.live} live · {s.backtest} backtest{s.winRate != null && ` · ${formatPercent(s.winRate, 0)} win`}
                    {s.expectancy != null && ` · ${money(s.expectancy)}/trade`}
                    {s.repsToGo > 0 && ` · ${s.repsToGo} more reps to go`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Coach>

        {/* 3 — checklist */}
        <Coach icon={ListChecks} problem="Vague entry rules" title="Checklist pays">
          {checklist.tracked === 0 ? (
            <Empty>
              Add a checklist to a{" "}
              <Link href="/playbook" className="text-brand-ink hover:underline">
                playbook setup
              </Link>
              , then tick what each trade met on its trade page. This card compares fully-checked trades with the rest.
            </Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: "All rules met", g: checklist.full, tone: "border-profit/30" },
                  { k: "Some rules missed", g: checklist.partial, tone: "border-loss/30" },
                ].map(({ k, g, tone }) => (
                  <div key={k} className={cn("rounded-xl border p-3", tone)}>
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="font-mono text-xl font-semibold tabular">{g.winRate == null ? "—" : formatPercent(g.winRate, 0)}</p>
                    <p className={cn("text-[11px] tabular", pnlText(g.expectancy ?? 0))}>
                      {g.trades} trades{g.expectancy != null && ` · ${money(g.expectancy)}/trade`}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-sm leading-relaxed">
                {checklist.full.expectancy != null && checklist.partial.expectancy != null && checklist.partial.trades > 0
                  ? checklist.full.expectancy > checklist.partial.expectancy
                    ? `Following every rule earns ${formatMoney(checklist.full.expectancy - checklist.partial.expectancy, currency)} more per trade. Only take setups that tick every box.`
                    : "So far, skipping a rule hasn't cost you — review whether every rule is really needed."
                  : `${checklist.tracked} trades tracked. Keep ticking checklists to compare.`}
              </p>
            </>
          )}
        </Coach>

        {/* 6 — heatmap (full width) */}
        <Coach icon={CalendarClock} problem="FOMO and screen-watching all day" title="When you trade best" className="lg:col-span-2">
          {!enough ? (
            <Empty>Needs at least 10 closed trades.</Empty>
          ) : (
            <>
              <div className="overflow-x-auto">
                <div className="grid min-w-[640px] grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-[3px] text-[10px]">
                  <span />
                  {hours.map((h) => (
                    <span key={h} className="text-center text-muted-foreground tabular">
                      {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
                    </span>
                  ))}
                  {dayOrder.map((d) => [
                    <span key={`l${d}`} className="flex items-center text-muted-foreground">
                      {dayNames[d]}
                    </span>,
                    ...hours.map((h) => {
                      const c = heat.cells.get(`${d}-${h}`);
                      const best = heat.best.some((z) => z.weekday === d && z.hour === h);
                      const avoid = heat.avoid.some((z) => z.weekday === d && z.hour === h);
                      return (
                        <span
                          key={`${d}-${h}`}
                          title={c ? `${dayNames[d]} ${String(h).padStart(2, "0")}:00 · ${c.trades} trades · ${money(c.net)}` : undefined}
                          className={cn(
                            "aspect-square rounded-[4px] border bg-muted/30",
                            best && "ring-2 ring-profit ring-offset-1 ring-offset-card",
                            avoid && "ring-2 ring-loss ring-offset-1 ring-offset-card",
                          )}
                          style={c ? pnlFill(c.net, heat.maxAbs, 1.6) : undefined}
                        />
                      );
                    }),
                  ])}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-profit">Trade zones</p>
                  {heat.best.length ? (
                    <ul className="grid gap-1 text-sm">
                      {heat.best.map((z) => (
                        <li key={`${z.weekday}-${z.hour}`} className="flex justify-between gap-2 tabular">
                          <span>{zoneLabel(z)}</span>
                          <span className="text-muted-foreground">
                            {formatPercent(z.winRate, 0)} win · <span className="text-profit">{money(z.expectancy)}/trade</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>No hour with {ZONE_MIN_TRADES}+ trades in profit yet.</Empty>
                  )}
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-loss">Avoid zones</p>
                  {heat.avoid.length ? (
                    <ul className="grid gap-1 text-sm">
                      {heat.avoid.map((z) => (
                        <li key={`${z.weekday}-${z.hour}`} className="flex justify-between gap-2 tabular">
                          <span>{zoneLabel(z)}</span>
                          <span className="text-muted-foreground">
                            {formatPercent(z.winRate, 0)} win · <span className="text-loss">{money(z.expectancy)}/trade</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>No losing hour with {ZONE_MIN_TRADES}+ trades. Good.</Empty>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                By the hour you opened the trade, in your timezone. Zones need {ZONE_MIN_TRADES}+ trades. You&apos;ll get a banner when a new trade opens in
                an avoid zone.
              </p>
            </>
          )}
        </Coach>
      </div>
    </section>
  );
}
