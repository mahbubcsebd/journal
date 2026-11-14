import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getSelectedAccountIds, requireUser } from "@/lib/session";
import { getTagStats } from "@/server/queries/tags";
import { TagBoard } from "./tag-board";

export const metadata: Metadata = { title: "Tags & mistakes" };

export default function TagsPage() {
  return (
    <>
      <PageHeader
        title="Tags & mistakes"
        description="Label trades your way, then see exactly what each habit costs or earns you."
      />
      <Suspense
        fallback={
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        }
      >
        <Board />
      </Suspense>
    </>
  );
}

async function Board() {
  const user = await requireUser();
  const { ids } = await getSelectedAccountIds(user.id);
  const { tags, currency } = await getTagStats(user.id, ids);
  return <TagBoard tags={tags} currency={currency} />;
}
