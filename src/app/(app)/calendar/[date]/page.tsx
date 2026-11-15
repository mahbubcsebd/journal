import type { Metadata } from "next";
import { ArrowLeft, ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DayDetail } from "@/components/calendar/day-detail";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, formatDay, isDay } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { getDayDetail } from "@/server/actions/calendar";

export const metadata: Metadata = { title: "Day" };

export default function DayPage({ params }: PageProps<"/calendar/[date]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] rounded-xl" />}>
      <Day params={params} />
    </Suspense>
  );
}

async function Day({ params }: { params: PageProps<"/calendar/[date]">["params"] }) {
  const [, { date }] = await Promise.all([requireUser(), params]);
  if (!isDay(date)) notFound();
  const data = await getDayDetail(date);
  if (!data) notFound();
  return (
    <div className="max-w-4xl">
      <Link
        href={`/calendar?view=month&d=${date}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Calendar
      </Link>
      <PageHeader
        title={formatDay(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        description="Every order opened or closed on this day, plus deposits and withdrawals, in your timezone."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/journal/${date}`}>
                <NotebookPen /> Journal this day
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="Previous day">
              <Link href={`/calendar/${addDays(date, -1)}`}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="Next day">
              <Link href={`/calendar/${addDays(date, 1)}`}>
                <ChevronRight />
              </Link>
            </Button>
          </>
        }
      />
      <DayDetail data={data} />
    </div>
  );
}
