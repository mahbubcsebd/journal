"use client";

import { ArrowDownRight, ArrowUpRight, Bot, Loader2, MoveHorizontal, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EventAnalysis } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";
import { analyzeEvent } from "@/server/actions/news";

type Lang = "en" | "bn";

const DIR = {
  up: { icon: ArrowUpRight, cls: "text-profit", en: "Up", bn: "উপরে" },
  down: { icon: ArrowDownRight, cls: "text-loss", en: "Down", bn: "নিচে" },
  volatile: { icon: MoveHorizontal, cls: "text-warning-ink", en: "Volatile", bn: "অস্থির" },
  neutral: { icon: MoveHorizontal, cls: "text-muted-foreground", en: "Little change", bn: "সামান্য" },
} as const;

const T = {
  en: {
    title: "AI explanation",
    sub: "What this release is, and how markets usually react. Not financial advice.",
    explain: "Explain this news",
    regenerate: "Regenerate",
    what: "What it is",
    why: "Why it matters",
    scenarios: "Scenarios",
    affected: "Symbols it moves",
    ifBetter: "If better than forecast",
    plan: "How to trade it safely",
    vol: "Expected volatility",
    low: "Low",
    medium: "Medium",
    high: "High",
    gold: "Gold",
    notSet: "Add GEMINI_API_KEY to enable AI explanations.",
  },
  bn: {
    title: "AI ব্যাখ্যা",
    sub: "এই নিউজটা কী এবং মার্কেট সাধারণত কীভাবে প্রতিক্রিয়া দেখায়। এটা আর্থিক পরামর্শ নয়।",
    explain: "এই নিউজটা ব্যাখ্যা করো",
    regenerate: "আবার তৈরি করো",
    what: "এটা কী",
    why: "কেন গুরুত্বপূর্ণ",
    scenarios: "সম্ভাব্য পরিস্থিতি",
    affected: "যেসব সিম্বল নড়বে",
    ifBetter: "ফোরকাস্টের চেয়ে ভালো হলে",
    plan: "নিরাপদে কীভাবে ট্রেড করবেন",
    vol: "সম্ভাব্য ভোলাটিলিটি",
    low: "কম",
    medium: "মাঝারি",
    high: "বেশি",
    gold: "গোল্ড",
    notSet: "AI ব্যাখ্যা চালু করতে GEMINI_API_KEY যোগ করুন।",
  },
} as const;

export function EventAi({
  id,
  initial,
  defaultLang,
  configured,
}: {
  id: string;
  initial: Partial<Record<Lang, EventAnalysis>>;
  defaultLang: Lang;
  configured: boolean;
}) {
  const [lang, setLang] = useState<Lang>(initial[defaultLang] || !initial.en ? defaultLang : "en");
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = T[lang];
  const a = data[lang];

  const run = (force = false) =>
    start(async () => {
      setError(null);
      const r = await analyzeEvent(id, lang, force);
      if (r.ok) setData((d) => ({ ...d, [lang]: r.data }));
      else setError(r.error);
    });

  return (
    <Card className="grid gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Bot className="size-[18px]" />
          </span>
          <div>
            <h2 className="font-semibold tracking-tight">{t.title}</h2>
            <p className="text-sm text-muted-foreground">{t.sub}</p>
          </div>
        </div>
        <div className="inline-flex h-9 items-center rounded-lg border bg-card p-0.5">
          {(["en", "bn"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLang(l);
                setError(null);
              }}
              className={cn(
                "h-full rounded-md px-3 text-[13px] font-medium transition",
                lang === l ? "bg-secondary text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l === "en" ? "English" : "বাংলা"}
            </button>
          ))}
        </div>
      </div>

      {!configured ? (
        <p className="text-sm text-muted-foreground">{t.notSet}</p>
      ) : !a ? (
        <div className="grid justify-items-start gap-3">
          <Button onClick={() => run()} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {t.explain}
          </Button>
          {error && <p className="text-sm text-loss">{error}</p>}
        </div>
      ) : (
        <div className={cn("grid gap-6", pending && "opacity-60")} lang={lang === "bn" ? "bn" : "en"}>
          <p className="text-lg leading-snug font-semibold tracking-tight">{a.headline}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.what}</p>
              <p className="text-sm leading-relaxed">{a.whatItIs}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.why}</p>
              <p className="text-sm leading-relaxed">{a.whyItMatters}</p>
            </div>
          </div>

          {a.scenarios.length > 0 && (
            <div className="grid gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.scenarios}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {a.scenarios.map((s, i) => (
                  <div key={i} className="grid gap-1.5 rounded-xl border bg-muted/30 p-3.5 text-sm">
                    <p className="font-semibold">{s.outcome}</p>
                    <p>{s.currencyEffect}</p>
                    {s.goldEffect && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">{t.gold}:</span> {s.goldEffect}
                      </p>
                    )}
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{s.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {a.affected.length > 0 && (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t.affected} · {t.ifBetter}
                </p>
                <Badge variant={a.volatility === "high" ? "loss" : a.volatility === "medium" ? "warning" : "default"}>
                  {t.vol}: {t[a.volatility]}
                </Badge>
              </div>
              <ul className="grid divide-y rounded-xl border">
                {a.affected.map((s) => {
                  const d = DIR[s.direction];
                  return (
                    <li key={s.symbol} className="flex items-start gap-3 px-3.5 py-2.5 text-sm">
                      <span className="w-20 shrink-0 font-mono font-medium">{s.symbol}</span>
                      <span className={cn("inline-flex w-28 shrink-0 items-center gap-1 font-medium", d.cls)}>
                        <d.icon className="size-4" /> {d[lang]}
                      </span>
                      <span className="text-muted-foreground">{s.ifBetter}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="grid gap-2 rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
            <p className="text-xs font-medium tracking-wide text-brand-ink uppercase">{t.plan}</p>
            <ol className="grid list-decimal gap-1.5 pl-5 text-sm leading-relaxed">
              {a.tradingPlan.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </div>

          {a.caution && (
            <p className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" /> {a.caution}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => run(true)} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} {t.regenerate}
            </Button>
            {error && <p className="text-sm text-loss">{error}</p>}
          </div>
        </div>
      )}
    </Card>
  );
}
