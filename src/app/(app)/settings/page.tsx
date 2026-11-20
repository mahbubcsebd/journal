import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { DEFAULT_COOLDOWN_MINUTES } from "@/lib/mindset";
import { DEFAULT_NEWS_AFTER, DEFAULT_NEWS_BEFORE } from "@/lib/news";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscription } from "@/db/schema";
import { telegramConfigured } from "@/server/services/alerts";
import { AlertsSettings } from "./alerts-settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Profile, timezone, currency and appearance."
      />
      <Suspense fallback={<Skeleton className="h-96 max-w-2xl rounded-xl" />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const user = await requireUser();
  const [{ n: devices }] = await db
    .select({ n: count() })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, user.id))
    .catch(() => [{ n: 0 }]);
  const st = user.settings;
  return (
    <div className="grid max-w-2xl gap-6">
      <SettingsForm
        email={user.email}
        name={user.name}
        timezone={user.timezone}
        baseCurrency={user.baseCurrency}
        weekStartsOn={user.settings.weekStartsOn ?? 1}
        emailWeeklyReport={user.settings.emailWeeklyReport !== false}
        emailGoalAlerts={user.settings.emailGoalAlerts !== false}
        cooldownMinutes={
          user.settings.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES
        }
        news={{
          impact: user.settings.newsImpact ?? "High",
          currencies: user.settings.newsCurrencies ?? [],
          before: user.settings.newsBefore ?? DEFAULT_NEWS_BEFORE,
          after: user.settings.newsAfter ?? DEFAULT_NEWS_AFTER,
        }}
      />
      <AlertsSettings
        vapidKey={process.env.VAPID_PUBLIC_KEY ?? null}
        telegramReady={telegramConfigured()}
        telegramConnected={Boolean(st.telegramChatId)}
        devices={devices}
        prefs={{
          notifyNews: st.notifyNews !== false,
          notifyCooldown: st.notifyCooldown !== false,
          notifyLimits: st.notifyLimits !== false,
          notifyReviews: st.notifyReviews !== false,
          notifyGuard: st.notifyGuard !== false,
          notifyNewsMinutes: st.notifyNewsMinutes ?? 15,
          guardAlerts: st.guardAlerts !== false,
          guardAutoClose: st.guardAutoClose === true,
          locale: st.locale === "bn" ? "bn" : "en",
        }}
      />
    </div>
  );
}
