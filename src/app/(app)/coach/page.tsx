import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { coachReport } from "@/db/schema";
import { aiConfigured } from "@/lib/ai/gemini";
import { getSelectedAccountIds, getUserAccounts, requireUser } from "@/lib/session";
import { getConversation, listConversations, type CoachMessageView } from "@/server/queries/coach";
import { getNewsPrefs } from "@/server/queries/news";
import { CoachChat } from "./coach-chat";

export const metadata: Metadata = { title: "AI Coach" };
// Reviews and pre-trade checks run long AI calls from this page.
export const maxDuration = 120;

export default function CoachPage({ searchParams }: PageProps<"/coach">) {
  return (
    <Suspense fallback={<Skeleton className="h-[calc(100dvh-10rem)] rounded-xl" />}>
      <Coach searchParams={searchParams} />
    </Suspense>
  );
}

async function Coach({ searchParams }: { searchParams: PageProps<"/coach">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const cid = one(sp.c);
  // Tables may not exist yet if the migration hasn't been run.
  const listed = await listConversations(user.id).catch((e: unknown) => {
    console.error("[coach] list failed", e);
    return null;
  });
  const ready = listed != null;
  const conversations = listed ?? [];
  const current = cid && ready ? await getConversation(user.id, cid).catch(() => null) : null;
  const [{ ids }, accounts, prefs] = await Promise.all([getSelectedAccountIds(user.id), getUserAccounts(user.id), getNewsPrefs(user)]);
  const currency = accounts.find((a) => ids.includes(a.id))?.currency;
  if (current) {
    // Opening a review marks it read.
    after(() =>
      db
        .update(coachReport)
        .set({ readAt: new Date() })
        .where(and(eq(coachReport.conversationId, current.id), isNull(coachReport.readAt)))
        .catch(() => {}),
    );
  }
  return (
    <CoachChat
      key={current?.id ?? "new"}
      ready={ready}
      configured={aiConfigured()}
      currency={currency ?? user.baseCurrency}
      firstName={user.name.split(" ")[0] ?? ""}
      conversations={conversations.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }))}
      conversationId={current?.id ?? null}
      initialMessages={(current?.messages ?? []).map(
        (m): CoachMessageView => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
          toolsUsed: m.toolsUsed,
          feedback: m.feedback,
          images: m.images,
        }),
      )}
      ask={one(sp.ask)?.slice(0, 2000)}
      replyLang={user.settings.coachLanguage ?? "auto"}
      accounts={accounts
        .filter((a) => ids.includes(a.id))
        .concat(accounts.filter((a) => !ids.includes(a.id)))
        .map((a) => ({ id: a.id, name: a.nickname, currency: a.currency, balance: a.balance }))}
      symbols={prefs.symbols.slice(0, 30)}
      dailyReport={user.settings.coachDailyReport !== false}
      weeklyReport={user.settings.coachWeeklyReport !== false}
    />
  );
}
