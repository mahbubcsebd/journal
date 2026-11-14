"use client";

import { motion } from "motion/react";
import { CheckCircle2, Lightbulb, Target, TrendingDown, TrendingUp } from "lucide-react";
import type { Review } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";

const GRADE: Record<Review["grade"], string> = {
  A: "bg-chart-up text-white",
  B: "bg-chart-up/70 text-white",
  C: "bg-warning text-black",
  D: "bg-chart-down/80 text-white",
  F: "bg-chart-down text-white",
};

function List({ title, icon: Icon, items, tone }: { title: string; icon: typeof TrendingUp; items: { title: string; detail: string }[]; tone: "up" | "down" }) {
  if (items.length === 0) return null;
  return (
    <div className="grid content-start gap-2.5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={cn("size-4", tone === "up" ? "text-profit" : "text-loss")} /> {title}
      </p>
      {items.map((x, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.05 }}
          className={cn("rounded-xl border p-3.5", tone === "up" ? "bg-profit-soft/40" : "bg-loss-soft/40")}
        >
          <p className="text-sm font-medium">{x.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{x.detail}</p>
        </motion.div>
      ))}
    </div>
  );
}

export function ReviewView({ review }: { review: Review }) {
  return (
    <div className="grid gap-6">
      <div className="flex items-start gap-4">
        <motion.span
          initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold", GRADE[review.grade])}
          title="Process grade"
          aria-label={`Grade ${review.grade}`}
        >
          {review.grade}
        </motion.span>
        <div className="grid gap-1.5">
          <h2 className="text-lg font-semibold tracking-tight text-balance">{review.headline}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{review.summary}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <List title="Strengths" icon={TrendingUp} items={review.strengths} tone="up" />
        <List title="Weaknesses" icon={TrendingDown} items={review.weaknesses} tone="down" />
      </div>

      {review.patterns.length > 0 && (
        <div className="grid gap-2.5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="size-4 text-warning-ink" /> Patterns
          </p>
          <div className="grid gap-2.5 md:grid-cols-2">
            {review.patterns.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }} className="rounded-xl border p-3.5">
                <p className="text-sm font-medium">{p.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{p.detail}</p>
                {p.evidence && <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">{p.evidence}</p>}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2.5 rounded-2xl border border-brand/30 bg-brand-soft/40 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4 text-brand-ink" /> Your rules for next period
        </p>
        <ol className="grid gap-2">
          {review.actions.map((a, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }} className="flex gap-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-ink" />
              <span className="text-sm">
                <span className="font-medium">{a.title}.</span> <span className="text-muted-foreground">{a.detail}</span>
              </span>
            </motion.li>
          ))}
        </ol>
      </div>
    </div>
  );
}
