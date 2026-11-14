"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Loader2, NotebookPen, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/dates";
import { getDayDetail, type DayDetailData } from "@/server/actions/calendar";
import { DayDetail } from "./day-detail";

export function DayDrawer({ day, onClose }: { day: string | null; onClose: () => void }) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [data, setData] = useState<DayDetailData | null>(null);
  const [pending, start] = useTransition();

  const close = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!day) return;
    start(async () => {
      setData(null);
      setData(await getDayDetail(day));
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [day]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {day && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Trades on ${day}`}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l bg-background shadow-pop"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
          >
            <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <p className="text-xs text-muted-foreground">{formatDay(day, { weekday: "long" })}</p>
                <h2 className="text-lg font-semibold tracking-tight">{formatDay(day, { month: "long", day: "numeric", year: "numeric" })}</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/journal/${day}`}>
                    <NotebookPen /> Journal
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/calendar/${day}`}>
                    Open day <ArrowUpRight />
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
                  <X />
                </Button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-5">
              {pending || !data ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DayDetail data={data} compact />
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
