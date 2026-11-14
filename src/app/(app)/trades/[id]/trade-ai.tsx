"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TradeFeedback } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";
import { reviewTrade } from "@/server/actions/insights";

export function TradeAi({ tradeId, initial, configured, language }: { tradeId: string; initial: TradeFeedback | null; configured: boolean; language: "en" | "bn" }) {
  const [fb, setFb] = useState(initial);
  const [lang, setLang] = useState(language);
  const [pending, start] = useTransition();
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Bot className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">AI coach</p>
            <p className="text-[13px] text-muted-foreground">Feedback on this trade&apos;s process, using your notes and setup rules.</p>
          </div>
        </div>
        {configured ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setLang(lang === "en" ? "bn" : "en")} className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              {lang === "en" ? "English" : "বাংলা"}
            </button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await reviewTrade(tradeId, lang);
                  if (r.ok) setFb(r.data);
                  else toast.error(r.error);
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {fb ? "Review again" : "Review this trade"}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Set GEMINI_API_KEY to enable</span>
        )}
      </div>
      <AnimatePresence>
        {fb && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
            <div className="mt-4 grid gap-4 border-t pt-4">
              <div className="flex items-start gap-3">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl font-mono text-lg font-bold text-white", fb.score >= 7 ? "bg-chart-up" : fb.score >= 4 ? "bg-warning" : "bg-chart-down")}>
                  {fb.score}
                </span>
                <p className="text-sm leading-relaxed">{fb.verdict}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { t: "Went well", xs: fb.wentWell, c: "text-profit" },
                  { t: "To improve", xs: fb.improve, c: "text-loss" },
                ].map((g) => (
                  <div key={g.t} className="grid content-start gap-1.5">
                    <p className={cn("text-xs font-semibold uppercase", g.c)}>{g.t}</p>
                    <ul className="grid gap-1 text-[13px] text-muted-foreground">
                      {g.xs.map((x, i) => (
                        <li key={i}>• {x}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {fb.ruleCheck && <p className="rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground"><span className="font-medium text-foreground">Rule check: </span>{fb.ruleCheck}</p>}
              <p className="text-sm"><span className="font-medium">Next time: </span>{fb.nextTime}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
