import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserAccounts, requireUser } from "@/lib/session";
import { AccountDialog } from "./account-dialog";
import { AccountList } from "./account-list";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <>
      <PageHeader
        title="Trading accounts"
        description="Every Exness MT5 login you trade — Standard, Cent, Pro, Raw, Zero, real or demo — tracked separately."
        actions={<AccountDialog />}
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
  const accounts = await getUserAccounts(user.id);
  return <AccountList accounts={accounts} />;
}
