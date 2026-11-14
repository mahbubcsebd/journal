import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DayDetail } from "@/components/calendar/day-detail";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, formatDay, isDay } from "@/lib/dates";
import { DEFAULT_CHECKLIST } from "@/lib/journal";
import { requireUser } from "@/lib/session";
import { getDayDetail } from "@/server/actions/calendar";
import { getJournalEntry } from "@/server/queries/journal";
import { JournalEditor } from "./journal-editor";

export const metadata: Metadata = { title: "Journal entry" };

export default function JournalDayPage({ params }: PageProps<"/journal/[date]">) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <Skeleton className="h-[700px] rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      }
    >
      <JournalDay params={params} />
    </Suspense>
  );
}

async function JournalDay({ params }: { params: PageProps<"/journal/[date]">["params"] }) {
  const [user, { date }] = await Promise.all([requireUser(), params]);
  if (!isDay(date)) notFound();
  const [entry, day] = await Promise.all([getJournalEntry(user.id, date), getDayDetail(date)]);

  return (
    <div className="grid gap-6">
      <FadeIn className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <Link href="/journal" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Journal
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{formatDay(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="sm">
            <Link href={`/calendar/${date}`}>
              <CalendarDays /> Calendar
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label="Previous day">
            <Link href={`/journal/${addDays(date, -1)}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label="Next day">
            <Link href={`/journal/${addDays(date, 1)}`}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
      </FadeIn>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_420px]">
        <JournalEditor
          key={date}
          day={date}
          checklistTemplate={user.settings.dailyChecklist ?? DEFAULT_CHECKLIST}
          initial={{
            premarket: entry?.premarket ?? {},
            review: entry?.review ?? {},
            mood: entry?.mood ?? null,
          }}
          exists={Boolean(entry)}
        />
        <FadeIn delay={0.1} className="xl:sticky xl:top-24">
          <Card className="p-5">
            <p className="mb-4 text-sm font-semibold">The day in numbers</p>
            {day ? <DayDetail data={day} compact /> : null}
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
