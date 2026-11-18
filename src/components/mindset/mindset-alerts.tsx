import { Suspense } from "react";
import { GoalAlertBanner, type Alert } from "@/components/goals/goal-alert-banner";
import { weekdayLabels } from "@/lib/dates";
import { getCurrentUser } from "@/lib/session";
import { formatMoney } from "@/lib/utils";
import { getMindsetAlerts } from "@/server/queries/mindset";
import { newsTrades } from "@/lib/news";
import type { ATrade } from "@/lib/analytics";
import { getEvents, getTradesOpenedBetween, getUpcomingRelevant } from "@/server/queries/news";
import type { User } from "@/db/schema";

/** Cooldown after a loss, revenge trades and trades in losing hours — above every page. */
export function MindsetAlerts() {
  return (
    <Suspense>
      <Alerts />
    </Suspense>
  );
}

async function Alerts() {
  const user = await getCurrentUser();
  if (!user?.onboarded) return null;
  const tz = user.timezone;
  const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const days = weekdayLabels(0);
  // A nudge must never break the page it sits on.
  const raw = await getMindsetAlerts(user.id, tz, user.settings.cooldownMinutes).catch((e) => {
    console.error("[mindset] alerts failed", e);
    return [];
  });
  const alerts: Alert[] = raw.map((a): Alert => {
    switch (a.kind) {
      case "cooldown":
        return {
          id: a.key,
          tone: "warning",
          link: { href: "/settings", label: "Cooldown" },
          text: `Cooldown: you closed ${a.symbol} at ${formatMoney(a.net, a.currency, { sign: true })} at ${time(a.closedAt)}. Take a break until ${time(a.until)} — no revenge trades.`,
        };
      case "revenge":
        return {
          id: a.key,
          tone: "danger",
          link: { href: "/psychology", label: "Psychology" },
          text: `Possible revenge trade: ${a.symbol} was opened ${a.minutesAfter} min after a loss. Was it on your checklist?`,
        };
      case "avoid":
        return {
          id: a.key,
          tone: "warning",
          link: { href: "/psychology", label: "Your hours" },
          text: `${a.symbol} was opened in one of your losing hours (${days[a.weekday]} ${String(a.hour).padStart(2, "0")}:00 — ${formatMoney(a.net, a.currency, { sign: true })} over ${a.trades} trades).`,
        };
    }
  });
  alerts.push(...(await newsAlerts(user, time).catch(() => [])));
  if (alerts.length === 0) return null;
  return <GoalAlertBanner alerts={alerts} />;
}

/** No-trade window right now, and trades just opened inside one. */
async function newsAlerts(user: User, time: (iso: string) => string): Promise<Alert[]> {
  const now = Date.now();
  const { events, prefs } = await getUpcomingRelevant(user, 6);
  const w = prefs.window;
  const out: Alert[] = [];
  const live = events.find((e) => e.impact === "High" && now >= e.time.getTime() - w.before * 60_000 && now < e.time.getTime());
  if (live) {
    const mins = Math.max(1, Math.round((live.time.getTime() - now) / 60_000));
    out.push({
      id: `news-window-${live.id}`,
      tone: "warning",
      link: { href: `/news/${live.id}`, label: "News" },
      text: `${live.currency} ${live.title} in ${mins} min (${time(live.time.toISOString())}). No-trade window: don't open new trades until ${w.after} min after the release.`,
    });
  }
  const recent = await getTradesOpenedBetween(user.id, new Date(now - 3 * 3_600_000), new Date(now));
  if (recent.length) {
    const around = await getEvents(new Date(now - 3 * 3_600_000 - w.before * 60_000), new Date(now + w.before * 60_000));
    const hits = newsTrades(
      recent.map((t) => ({ id: t.id, symbol: t.symbol, openAt: t.openTime.getTime() }) as ATrade),
      around.filter((e) => !prefs.currencies || prefs.currencies.has(e.currency)),
      w,
    );
    for (const h of hits.slice(0, 2)) {
      out.push({
        id: `news-trade-${h.trade.id}`,
        tone: "danger",
        link: { href: `/news/${h.event.id}`, label: "News" },
        text: `News trade: ${h.trade.symbol} was opened ${Math.abs(h.minutes)} min ${h.minutes < 0 ? "before" : "after"} ${h.event.currency} ${h.event.title}. Spreads and slippage are worst now — manage risk.`,
      });
    }
  }
  return out;
}
