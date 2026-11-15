import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { syncKey } from "@/db/schema";
import { getUserAccounts, requireUser } from "@/lib/session";
import { metaApiConfigured } from "@/server/services/metaapi";
import { AccountDialog } from "./account-dialog";
import { AccountList } from "./account-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <>
      <PageHeader
        title="Trading accounts"
        description="Every Exness MT5 login you trade — tracked separately and synced automatically through the MT5 EA or MetaApi."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/guide/mt5">
                <BookOpen /> Setup guide
              </Link>
            </Button>
            <AccountDialog />
          </>
        }
      />
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        }
      >
        <Accounts />
      </Suspense>
    </>
  );
}

async function Accounts() {
  const user = await requireUser();
  const [accounts, keys, h] = await Promise.all([
    getUserAccounts(user.id),
    db.select().from(syncKey).where(eq(syncKey.userId, user.id)).orderBy(desc(syncKey.createdAt)),
    headers(),
  ]);
  const origin = (process.env.NEXT_PUBLIC_APP_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`).replace(/\/$/, "");
  return (
    <AccountList
      accounts={accounts}
      origin={origin}
      metaApi={metaApiConfigured()}
      keys={keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revoked: Boolean(k.revokedAt) }))}
    />
  );
}
