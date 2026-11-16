"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, PartyPopper, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export type Alert = {
  id: string;
  tone: "danger" | "warning" | "success";
  text: string;
  /** Link shown at the end of the banner (default: Goals). */
  link?: { href: string; label: string };
};

const KEY = "jr_dismissed_alerts";
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

export function GoalAlertBanner({ alerts }: { alerts: Alert[] }) {
  const stored = useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem(KEY) ?? "[]",
    () => "[]",
  );
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  const hidden = dismissed ?? (JSON.parse(stored) as string[]);
  const visible = alerts.filter((a) => !hidden.includes(a.id));

  const dismiss = (id: string) => {
    const next = [...read(), id].slice(-50);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    setDismissed(next);
  };

  if (visible.length === 0) return null;
  return (
    <div className="mb-6 grid gap-2 print:hidden">
      <AnimatePresence initial={false}>
        {visible.map((a) => {
          const Icon = a.tone === "danger" ? ShieldAlert : a.tone === "warning" ? AlertTriangle : PartyPopper;
          return (
            <motion.div
              key={a.id}
              role={a.tone === "danger" ? "alert" : "status"}
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm",
                a.tone === "danger" && "border-loss/30 bg-loss-soft text-foreground",
                a.tone === "warning" && "border-warning/40 bg-warning/10",
                a.tone === "success" && "border-profit/30 bg-profit-soft",
              )}
            >
              <Icon className={cn("size-4 shrink-0", a.tone === "danger" ? "text-loss" : a.tone === "warning" ? "text-warning-ink" : "text-profit")} />
              <span className="flex-1">{a.text}</span>
              <Link href={a.link?.href ?? "/goals"} className="text-xs font-medium whitespace-nowrap underline-offset-4 hover:underline">
                {a.link?.label ?? "Goals"}
              </Link>
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(a.id)} className="rounded-md p-1 text-muted-foreground transition hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10">
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
