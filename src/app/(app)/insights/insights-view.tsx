"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bot, KeyRound, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ReviewView } from "@/components/ai/review-view";
import { pnlText } from "@/components/calendar/pnl-style";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Review } from "@/lib/ai/schemas";
import { cn, formatDateTime, formatMoney } from "@/lib/utils";
import { deleteInsight, generateReview, type ReviewPreset } from "@/server/actions/insights";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type InsightItem = {
  id: string;
  createdAt: string;
  model: string;
  review: Review;
  language: "en" | "bn";
  periodLabel: string;
  trades: number;
  net: number;
  currency: string;
};

const PRESETS: { key: ReviewPreset; label: string }[] = [
  { key: "last_week", label: "Last week" },
  { key: "this_week", label: "This week" },
  { key: "last_month", label: "Last month" },
  { key: "this_month", label: "This month" },
  { key: "last_30", label: "Last 30 days" },
];

export function InsightsView({
  items,
  selectedId,
  configured,
  model,
  language: initialLanguage,
  timezone,
}: {
  items: InsightItem[];
  selectedId: string | null;
  configured: boolean;
  model: string;
  language: "en" | "bn";
  timezone: string;
}) {
  const confirm = useConfirm();
  const router = useRouter();
  const [preset, setPreset] = useState<ReviewPreset>("last_week");
  const [language, setLanguage] = useState(initialLanguage);
  const [pending, start] = useTransition();
  const selected = items.find((i) => i.id === selectedId) ?? null;

  const generate = () =>
    start(async () => {
      const res = await generateReview({ preset, language });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Review ready");
      router.push(`/insights?id=${res.id}`, { scroll: false });
      router.refresh();
    });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-6">
        <Card className="relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-brand/15 blur-3xl" />
          <div className="relative grid gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-[oklch(0.55_0.14_260)] text-white">
                <Bot className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">New review</p>
                <p className="text-[13px] text-muted-foreground">Uses the accounts selected above, your journal and your notes. Runs on Gemini ({model}).</p>
              </div>
            </div>
            {!configured ? (
              <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-warning-ink" />
                <div className="grid gap-1">
                  <p className="font-medium">Add a Gemini API key to turn this on</p>
                  <p className="text-muted-foreground">
                    Create a free key at Google AI Studio, then set <code className="rounded bg-muted px-1">GEMINI_API_KEY</code> in your Vercel project&apos;s environment variables and redeploy.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex flex-wrap rounded-lg border bg-card p-0.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPreset(p.key)}
                      className={cn("rounded-md px-2.5 py-1.5 text-[13px] font-medium transition", preset === p.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label="Language">
                  {(["en", "bn"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLanguage(l)}
                      className={cn("rounded-md px-2.5 py-1.5 text-[13px] font-medium transition", language === l ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                      {l === "en" ? "English" : "বাংলা"}
                    </button>
                  ))}
                </div>
                <Button onClick={generate} disabled={pending} variant="brand" className="ml-auto">
                  {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {pending ? "Reading your trades…" : "Generate review"}
                </Button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Only statistics and the text you wrote in your journal are sent — never your name, email, account numbers or passwords. AI can be wrong; treat it as a second opinion, not financial advice.
            </p>
          </div>
        </Card>

        <AnimatePresence mode="wait">
          {pending ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="grid gap-4 p-6">
                {[0.9, 0.7, 0.8, 0.5].map((w, i) => (
                  <motion.div
                    key={i}
                    className="h-4 rounded-md bg-muted"
                    style={{ width: `${w * 100}%` }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </Card>
            </motion.div>
          ) : selected ? (
            <motion.div key={selected.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b pb-4 text-xs text-muted-foreground">
                  <span>
                    {selected.periodLabel} · {selected.trades} trades ·{" "}
                    <span className={cn("font-mono font-medium", pnlText(selected.net))}>{formatMoney(selected.net, selected.currency, { sign: true })}</span>
                  </span>
                  <span>Generated {formatDateTime(selected.createdAt, timezone)}</span>
                </div>
                <ReviewView review={selected.review} />
              </Card>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="px-6 py-14 text-center text-sm text-muted-foreground">Your reviews will appear here.</Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b px-4 py-3 text-sm font-semibold">History</div>
        <ul className="max-h-[560px] overflow-y-auto p-1.5">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">No reviews yet</li>}
          {items.map((i) => (
            <li key={i.id} className="group relative">
              <button
                type="button"
                onClick={() => router.push(`/insights?id=${i.id}`, { scroll: false })}
                className={cn("grid w-full gap-0.5 rounded-lg px-3 py-2.5 pr-9 text-left transition", i.id === selected?.id ? "bg-secondary" : "hover:bg-accent")}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex size-5 items-center justify-center rounded-md bg-muted text-[11px] font-bold">{i.review.grade}</span>
                  {i.periodLabel}
                </span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{i.review.headline}</span>
              </button>
              <button
                type="button"
                aria-label="Delete review"
                onClick={async () => (await confirm({ title: "Delete this review?", destructive: true })) && start(() => deleteInsight(i.id))}
                className="absolute top-2.5 right-2 rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-loss-soft hover:text-loss focus:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
