import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserAccounts, requireUser } from "@/lib/session";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import history"
        description="Bring in every past trade from an MT5 history report or an Exness Personal Area export."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Wizard />
      </Suspense>
    </>
  );
}

async function Wizard() {
  const user = await requireUser();
  const accounts = await getUserAccounts(user.id);
  return (
    <ImportWizard
      accounts={accounts.map((a) => ({ id: a.id, nickname: a.nickname, login: a.login, color: a.color, currency: a.currency }))}
    />
  );
}
