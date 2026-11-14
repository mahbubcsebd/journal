import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addDays,
  endOfMonth,
  isDay,
  monthGrid,
  startOfMonth,
  startOfWeek,
  todayIn,
  type WeekStart,
} from "@/lib/dates";
import { getSelectedAccountIds, requireUser } from "@/lib/session";
import { getClosedTrades, getDailyPnl } from "@/server/queries/calendar";
import { CalendarShell, type CalendarView } from "./calendar-shell";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <>
      <PageHeader title="Calendar" description="Every trading day, green or red. Click a day to see what happened." />
      <Suspense
        fallback={
          <div className="grid gap-4">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-[560px] rounded-xl" />
          </div>
        }
      >
        <CalendarData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CalendarData({ searchParams }: { searchParams: PageProps<"/calendar">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const view: CalendarView = one("view") === "week" || one("view") === "year" ? (one("view") as CalendarView) : "month";
  const today = todayIn(user.timezone);
  const anchor = isDay(one("d")) ? one("d")! : today;
  const weekStartsOn = (user.settings.weekStartsOn ?? 1) as WeekStart;

  let from: string;
  let to: string;
  let periodFrom: string;
  let periodTo: string;
  if (view === "year") {
    from = periodFrom = `${anchor.slice(0, 4)}-01-01`;
    to = periodTo = `${anchor.slice(0, 4)}-12-31`;
  } else if (view === "week") {
    from = periodFrom = startOfWeek(anchor, weekStartsOn);
    to = periodTo = addDays(from, 6);
  } else {
    const grid = monthGrid(anchor, weekStartsOn);
    from = grid[0][0];
    to = grid.at(-1)!.at(-1)!;
    periodFrom = startOfMonth(anchor);
    periodTo = endOfMonth(anchor);
  }

  const { ids } = await getSelectedAccountIds(user.id);
  const [{ days, currency }, trades] = await Promise.all([
    getDailyPnl(ids, from, to),
    view === "week" ? getClosedTrades(user.id, ids, from, to, user.timezone) : Promise.resolve([]),
  ]);

  return (
    <CalendarShell
      view={view}
      anchor={anchor}
      today={today}
      weekStartsOn={weekStartsOn}
      currency={currency}
      days={days}
      periodFrom={periodFrom}
      periodTo={periodTo}
      weekTrades={trades}
      timezone={user.timezone}
      hasAccounts={ids.length > 0}
    />
  );
}
