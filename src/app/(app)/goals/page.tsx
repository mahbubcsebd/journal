import type { Metadata } from "next";
import { Target } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserAccounts, requireUser } from "@/lib/session";
import { getGoalsWithProgress } from "@/server/queries/goals";
import { GoalBoard } from "./goal-board";
import { NewGoalDialog } from "./new-goal-dialog";

export const metadata: Metadata = { title: "Goals" };

export default function GoalsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-6">
          <Skeleton className="h-14 w-72 rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <Goals />
    </Suspense>
  );
}

async function Goals() {
  const user = await requireUser();
  const [goals, accounts] = await Promise.all([getGoalsWithProgress(user), getUserAccounts(user.id)]);
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Goals"
        description="Targets to aim for and limits that tell you when to stop. Progress updates as trades come in."
        actions={<NewGoalDialog accounts={accounts.map((a) => ({ id: a.id, label: `${a.nickname} · #${a.login}` }))} />}
      />
      {goals.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
            <Target className="size-6" />
          </span>
          <p className="font-medium">No goals yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Start with two: a <span className="text-foreground">daily max loss</span> so a bad day can&apos;t become a disaster, and a
            <span className="text-foreground"> max trades per day</span> to stop overtrading. You&apos;ll get a warning at the top of every page when you&apos;re close.
          </p>
          <NewGoalDialog accounts={accounts.map((a) => ({ id: a.id, label: `${a.nickname} · #${a.login}` }))} />
        </Card>
      ) : (
        <GoalBoard goals={goals} />
      )}
    </div>
  );
}
