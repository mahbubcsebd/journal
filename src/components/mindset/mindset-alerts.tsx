import { Suspense } from "react";
import { GoalAlertBanner, type Alert } from "@/components/goals/goal-alert-banner";
import { weekdayLabels } from "@/lib/dates";
import { getCurrentUser } from "@/lib/session";
import { formatMoney } from "@/lib/utils";
import { getMindsetAlerts } from "@/server/queries/mindset";

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
  if (alerts.length === 0) return null;
  return <GoalAlertBanner alerts={alerts} />;
}
