import type { Metadata } from "next";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { aiInsight } from "@/db/schema";
import { aiConfigured, aiModel } from "@/lib/ai/gemini";
import type { Review } from "@/lib/ai/schemas";
import { requireUser } from "@/lib/session";
import { InsightsView, type InsightItem } from "./insights-view";

export const metadata: Metadata = { title: "AI insights" };

export default function InsightsPage({ searchParams }: PageProps<"/insights">) {
  return (
    <>
      <PageHeader title="AI insights" description="A coach that reads your trades and journal, and tells you what to fix next." />
      <Suspense fallback={<Skeleton className="h-[600px] rounded-xl" />}>
        <Insights searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Insights({ searchParams }: { searchParams: PageProps<"/insights">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const rows = await db
    .select()
    .from(aiInsight)
    .where(and(eq(aiInsight.userId, user.id), isNull(aiInsight.tradeId)))
    .orderBy(desc(aiInsight.createdAt))
    .limit(30);
  const items: InsightItem[] = rows.map((r) => {
    const c = r.content as { review: Review; language: "en" | "bn"; periodLabel: string; trades: number; net: number; currency: string };
    return { id: r.id, createdAt: r.createdAt.toISOString(), model: r.model, ...c };
  });
  const id = typeof sp.id === "string" ? sp.id : null;
  return (
    <InsightsView
      items={items}
      selectedId={items.find((i) => i.id === id)?.id ?? items[0]?.id ?? null}
      configured={aiConfigured()}
      model={aiModel()}
      language={user.settings.aiLanguage ?? "en"}
      timezone={user.timezone}
    />
  );
}
