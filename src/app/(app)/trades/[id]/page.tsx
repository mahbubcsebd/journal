import type { Metadata } from "next";
import { ArrowLeft, ChevronLeft, ChevronRight, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, SESSION_LABEL } from "@/lib/trading/metrics";
import { getSelectedAccountIds, requireUser } from "@/lib/session";
import { cn, formatDateTime, formatMoney, formatPrice } from "@/lib/utils";
import { getFilterOptions, getNeighbours, getTrade } from "@/server/queries/trades";
import { PriceLadder } from "./price-ladder";
import { TradeReplay } from "@/components/charts/trade-replay";
import { TradeImages } from "./trade-images";
import { TradeAi } from "./trade-ai";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiInsight, tradeCandles } from "@/db/schema";
import { aiConfigured } from "@/lib/ai/gemini";
import type { TradeFeedback } from "@/lib/ai/schemas";
import { TradeJournal } from "./trade-journal";

export const metadata: Metadata = { title: "Trade" };

export default function TradePage({ params }: PageProps<"/trades/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-6">
          <Skeleton className="h-16 rounded-xl" />
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <Skeleton className="h-96 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      }
    >
      <TradeView params={params} />
    </Suspense>
  );
}

const SOURCE_LABEL = { METAAPI: "MetaApi sync", EA: "EA sync", IMPORT: "Imported", MANUAL: "Manual", SMC: "SMC Desk paper" } as const;

async function TradeView({ params }: { params: PageProps<"/trades/[id]">["params"] }) {
  const [user, { id }] = await Promise.all([requireUser(), params]);
  const t = await getTrade(user.id, id);
  if (!t) notFound();
  const { ids } = await getSelectedAccountIds(user.id);
  const [options, nav, [lastFeedback]] = await Promise.all([
    getFilterOptions(user.id),
    getNeighbours(user.id, ids, t.closeTime ?? t.openTime, t.id),
    db.select({ content: aiInsight.content }).from(aiInsight).where(and(eq(aiInsight.userId, user.id), eq(aiInsight.tradeId, t.id))).orderBy(desc(aiInsight.createdAt)).limit(1),
  ]);
  // Candles sent by the EA (table may not exist before migration 0010).
  const [replay] = await db
    .select({ timeframe: tradeCandles.timeframe, candles: tradeCandles.candles })
    .from(tradeCandles)
    .where(eq(tradeCandles.tradeId, t.id))
    .limit(1)
    .catch(() => []);
  const digits = Math.min(5, Math.max(...[t.openPrice, t.closePrice, t.sl, t.tp].filter((v): v is number => v != null).map((v) => (String(v).split(".")[1] ?? "").length), 2));
  const cur = t.account.currency;
  const tz = user.timezone;
  const pnlTone = t.status === "OPEN" ? "" : t.netPnl > 0 ? "text-profit" : t.netPnl < 0 ? "text-loss" : "";

  const stats: [string, React.ReactNode][] = [
    ["Entry", formatPrice(t.openPrice)],
    ["Exit", formatPrice(t.closePrice)],
    ["Size", `${t.volume.toFixed(2)} lots`],
    ["Pips", t.pips == null ? "—" : t.pips.toFixed(1)],
    ["R-multiple", t.rMultiple == null ? "Add a stop loss" : `${t.rMultiple.toFixed(2)}R`],
    ["Duration", formatDuration(t.durationSec)],
    ["Opened", formatDateTime(t.openTime, tz, { year: "numeric", second: "2-digit" })],
    ["Closed", t.closeTime ? formatDateTime(t.closeTime, tz, { year: "numeric", second: "2-digit" }) : "Still open"],
    ["Session", t.session ? SESSION_LABEL[t.session] : "—"],
    ["Gross P&L", formatMoney(t.grossPnl, cur, { sign: true })],
    ["Commission", formatMoney(t.commission, cur)],
    ["Swap", formatMoney(t.swap, cur, { sign: true })],
  ];

  return (
    <div className="grid gap-6">
      <FadeIn className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-2">
          <Link href="/trades" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Trades
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{t.symbol}</h1>
            <Badge variant={t.side === "LONG" ? "profit" : "loss"} className="text-xs">
              {t.side === "LONG" ? "Long" : "Short"}
            </Badge>
            {t.status === "OPEN" && <Badge variant="warning">Open</Badge>}
            {t.isBacktest && <Badge variant="outline">Backtest</Badge>}
            <Badge variant="outline">{SOURCE_LABEL[t.source]}</Badge>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: t.account.color }} />
              {t.account.nickname} · #{t.account.login}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className={cn("font-mono text-3xl font-semibold tracking-tight tabular", pnlTone)}>
              {formatMoney(t.netPnl, cur, { sign: true })}
            </p>
            <p className="text-xs text-muted-foreground">Net P&amp;L {t.status === "OPEN" && "(so far)"}</p>
          </div>
          <div className="flex gap-1">
            <Button asChild variant="outline" className="gap-1.5">
              <Link
                href={`/coach?ask=${encodeURIComponent(
                  `Review my ${t.symbol} ${t.side === "LONG" ? "buy" : "sell"} trade (id ${t.id}) in detail: what did I do wrong or right, was there news around it, and what should I do differently next time?`,
                )}`}
              >
                <MessagesSquare /> <span className="max-sm:hidden">Ask coach</span>
              </Link>
            </Button>
            <Button asChild={Boolean(nav.prev)} variant="outline" size="icon" disabled={!nav.prev} aria-label="Previous trade">
              {nav.prev ? (
                <Link href={`/trades/${nav.prev}`}>
                  <ChevronLeft />
                </Link>
              ) : (
                <ChevronLeft />
              )}
            </Button>
            <Button asChild={Boolean(nav.next)} variant="outline" size="icon" disabled={!nav.next} aria-label="Next trade">
              {nav.next ? (
                <Link href={`/trades/${nav.next}`}>
                  <ChevronRight />
                </Link>
              ) : (
                <ChevronRight />
              )}
            </Button>
          </div>
        </div>
      </FadeIn>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_400px]">
        <div className="grid gap-6">
          <FadeIn delay={0.05}>
            <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-3">
              {stats.map(([k, v]) => (
                <div key={k} className="bg-card px-5 py-4">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="mt-1 font-mono text-[15px] font-medium tabular">{v}</p>
                </div>
              ))}
            </Card>
          </FadeIn>
          <FadeIn delay={0.1}>
            {replay ? (
              <Card className="p-3 sm:p-4">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
                  <p className="text-sm font-semibold">Replay</p>
                  <p className="text-xs text-muted-foreground">
                    {replay.timeframe >= 60 ? `H${replay.timeframe / 60}` : `M${replay.timeframe}`} candles · your time
                  </p>
                </div>
                <TradeReplay
                  candles={replay.candles}
                  timeframe={replay.timeframe}
                  timezone={tz}
                  side={t.side}
                  entry={t.openPrice}
                  exit={t.closePrice}
                  sl={t.sl}
                  tp={t.tp}
                  openAt={t.openTime.getTime()}
                  closeAt={t.closeTime?.getTime() ?? null}
                  digits={digits}
                />
              </Card>
            ) : (
              <div className="grid gap-1.5">
                <PriceLadder side={t.side} entry={t.openPrice} exit={t.closePrice} sl={t.sl} tp={t.tp} />
                {t.account.syncMethod === "EA" && (
                  <p className="px-1 text-xs text-muted-foreground">The candle replay arrives from the MT5 EA (v1.05+) a few minutes after a trade closes.</p>
                )}
              </div>
            )}
          </FadeIn>
          <FadeIn delay={0.15}>
            <TradeImages tradeId={t.id} initial={t.images} />
          </FadeIn>
          <FadeIn delay={0.2}>
            <TradeAi
              tradeId={t.id}
              configured={aiConfigured()}
              language={user.settings.aiLanguage ?? "en"}
              initial={(lastFeedback?.content as { feedback?: TradeFeedback } | undefined)?.feedback ?? null}
            />
          </FadeIn>
        </div>
        <FadeIn delay={0.1}>
          <TradeJournal
            key={t.updatedAt.toISOString()}
            tradeId={t.id}
            initial={{
              rating: t.rating,
              setupId: t.setupId,
              emotionBefore: t.emotionBefore,
              emotionAfter: t.emotionAfter,
              followedPlan: t.followedPlan,
              notes: (t.notes as { text?: string } | null)?.text ?? "",
              sl: t.sl,
              isBacktest: t.isBacktest,
              tagIds: t.tagIds,
              checklist: t.checklist ?? null,
            }}
            tags={options.tags}
            setups={options.setups}
          />
        </FadeIn>
      </div>
    </div>
  );
}
