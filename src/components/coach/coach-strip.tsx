import { ArrowRight, Bot, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/db/schema";
import { parseBlock, type CardsBlock } from "@/lib/coach-blocks";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getUserAccounts } from "@/lib/session";
import { getNewsPrefs } from "@/server/queries/news";
import { latestCoachReport } from "@/server/services/coach-reports";
import { Button } from "@/components/ui/button";
import { PreTradeButton } from "./pretrade-button";

const TEXT = {
  en: { daily: "Daily review", weekly: "Weekly review", none: "Your AI coach", noneSub: "Ask about your mistakes, the news, or check a trade before you take it.", read: "Read review", ask: "Ask coach", new: "New" },
  bn: { daily: "দিনের রিভিউ", weekly: "সাপ্তাহিক রিভিউ", none: "আপনার AI কোচ", noneSub: "ভুল, নিউজ নিয়ে জিজ্ঞেস করুন, বা ট্রেড নেওয়ার আগে চেক করুন।", read: "রিভিউ পড়ুন", ask: "কোচকে জিজ্ঞেস", new: "নতুন" },
};

const TONE = { profit: "text-profit", loss: "text-loss", warning: "text-warning-ink", info: "text-info", neutral: "" } as const;

/** Plain first lines of a markdown answer, without the rich blocks. */
function excerpt(md: string, max = 220) {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s.*$/gm, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>|]/g, "")
    .replace(/^\s*[-\d.]+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

/** Dashboard strip: the latest AI review, a pre-trade check and a way into the chat. */
export function CoachStrip({ user }: { user: User }) {
  return (
    <Suspense>
      <Strip user={user} />
    </Suspense>
  );
}

async function Strip({ user }: { user: User }) {
  const lang = user.settings.coachLanguage === "bn" ? "bn" : "en";
  const t = TEXT[lang];
  // The coach tables may not exist yet; the dashboard must still load.
  const [report, accounts, prefs] = await Promise.all([
    latestCoachReport(user.id).catch(() => null),
    getUserAccounts(user.id),
    getNewsPrefs(user).catch(() => ({ symbols: [] as string[] })),
  ]);
  const cardsMatch = report ? /```cards\s*\n([\s\S]*?)```/.exec(report.content) : null;
  const cards = cardsMatch ? (parseBlock("cards", cardsMatch[1]) as CardsBlock | null) : null;
  const when = report ? formatDay(report.period, { day: "numeric", month: "short" }) : null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-gradient-to-br from-brand-soft/50 via-card to-card p-4 shadow-soft sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Bot className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {report ? `${report.kind === "daily" ? t.daily : t.weekly} · ${when}` : t.none}
            {report && !report.readAt && <Badge variant="profit">{t.new}</Badge>}
          </p>
          {report ? (
            <>
              {cards && (
                <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                  {cards.items.slice(0, 3).map((c, i) => (
                    <span key={i} className="text-sm">
                      <span className="text-muted-foreground">{c.label}: </span>
                      <span className={cn("font-mono font-semibold tabular", TONE[c.tone ?? "neutral"])}>{c.value}</span>
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{excerpt(report.content)}</p>
            </>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">{t.noneSub}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        <PreTradeButton
          lang={lang}
          symbols={prefs.symbols.slice(0, 30)}
          accounts={accounts.map((a) => ({ id: a.id, name: a.nickname, currency: a.currency, balance: a.balance }))}
        />
        {report?.conversationId ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/coach?c=${report.conversationId}`}>
              {t.read} <ArrowRight />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href="/coach">
              <MessagesSquare /> {t.ask}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
