import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { aiConfigured } from "@/lib/ai/gemini";
import { getSelectedAccountIds, getUserAccounts, requireUser } from "@/lib/session";
import { getConversation, listConversations, type CoachMessageView } from "@/server/queries/coach";
import { CoachChat } from "./coach-chat";

export const metadata: Metadata = { title: "AI Coach" };

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
  const [{ ids }, accounts] = await Promise.all([getSelectedAccountIds(user.id), getUserAccounts(user.id)]);
  const currency = accounts.find((a) => ids.includes(a.id))?.currency;
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
        (m): CoachMessageView => ({ id: m.id, role: m.role === "assistant" ? "assistant" : "user", content: m.content, toolsUsed: m.toolsUsed }),
      )}
      ask={one(sp.ask)?.slice(0, 2000)}
    />
  );
}
