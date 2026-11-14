import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { note } from "@/db/schema";
import { docToText } from "@/lib/doc";
import { requireUser } from "@/lib/session";
import { Notebook } from "./notebook";

export const metadata: Metadata = { title: "Notebook" };

export default function NotebookPage({ searchParams }: PageProps<"/notebook">) {
  return (
    <>
      <PageHeader title="Notebook" description="Ideas, research, reviews and lessons — everything that isn't tied to a single trade." />
      <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
        <NotebookData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NotebookData({ searchParams }: { searchParams: PageProps<"/notebook">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const notes = await db.select().from(note).where(eq(note.userId, user.id)).orderBy(desc(note.pinned), desc(note.updatedAt));
  const selected = typeof sp.id === "string" ? sp.id : null;
  return (
    <Notebook
      timezone={user.timezone}
      selectedId={selected && notes.some((n) => n.id === selected) ? selected : null}
      notes={notes.map((n) => ({
        id: n.id,
        title: n.title,
        folder: n.folder,
        pinned: n.pinned,
        content: n.content,
        preview: docToText(n.content, 140),
        updatedAt: n.updatedAt.toISOString(),
      }))}
    />
  );
}
