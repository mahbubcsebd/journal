"use client";

import { ArrowUpRight, Loader2, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDay } from "@/lib/dates";
import { getDayDetail, type DayDetailData } from "@/server/actions/calendar";
import { DayDetail } from "./day-detail";

export function DayDrawer({ day, onClose }: { day: string | null; onClose: () => void }) {
  const [data, setData] = useState<DayDetailData | null>(null);
  const [pending, start] = useTransition();
  // Keep the last day while the sheet animates closed.
  const [shown, setShown] = useState(day);
  if (day && day !== shown) setShown(day);

  useEffect(() => {
    if (!day) return;
    start(async () => {
      setData(null);
      setData(await getDayDetail(day));
    });
  }, [day]);

  return (
    <Sheet open={Boolean(day)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" showCloseButton>
        {shown && (
          <>
            <SheetHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b py-4 pr-14 pl-5">
              <div>
                <SheetDescription className="text-xs">{formatDay(shown, { weekday: "long" })}</SheetDescription>
                <SheetTitle className="text-lg">{formatDay(shown, { month: "long", day: "numeric", year: "numeric" })}</SheetTitle>
              </div>
              <div className="flex items-center gap-1">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/journal/${shown}`}>
                    <NotebookPen /> Journal
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/calendar/${shown}`}>
                    Open day <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-5">
              {pending || !data ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DayDetail data={data} compact />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
