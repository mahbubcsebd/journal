import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { DEFAULT_COOLDOWN_MINUTES } from "@/lib/mindset";
import { DEFAULT_NEWS_AFTER, DEFAULT_NEWS_BEFORE } from "@/lib/news";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Profile, timezone, currency and appearance." />
      <Suspense fallback={<Skeleton className="h-96 max-w-2xl rounded-xl" />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const user = await requireUser();
  return (
    <SettingsForm
      email={user.email}
      name={user.name}
      timezone={user.timezone}
      baseCurrency={user.baseCurrency}
      weekStartsOn={user.settings.weekStartsOn ?? 1}
      emailWeeklyReport={user.settings.emailWeeklyReport !== false}
      emailGoalAlerts={user.settings.emailGoalAlerts !== false}
      cooldownMinutes={user.settings.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES}
      news={{
        impact: user.settings.newsImpact ?? "High",
        currencies: user.settings.newsCurrencies ?? [],
        before: user.settings.newsBefore ?? DEFAULT_NEWS_BEFORE,
        after: user.settings.newsAfter ?? DEFAULT_NEWS_AFTER,
      }}
    />
  );
}
