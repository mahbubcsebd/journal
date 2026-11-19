"use client";

import { Brain, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { addCoachMemory, deleteCoachMemory, listCoachMemories, saveCoachPrefs } from "@/server/actions/coach";
import { COACH_TEXT, type CoachLang } from "./i18n";

const AUTO = {
  en: { title: "Automatic reviews", daily: "Daily review every morning (yesterday's trades)", weekly: "Weekly review on the first day of your week" },
  bn: { title: "নিজে থেকে রিভিউ", daily: "প্রতিদিন সকালে আগের দিনের রিভিউ", weekly: "সপ্তাহের প্রথম দিনে সাপ্তাহিক রিভিউ" },
};

/** Coach memory and automatic review settings, in a side sheet. */
export function CoachSettings({
  open,
  onOpenChange,
  lang,
  daily,
  weekly,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lang: CoachLang;
  daily: boolean;
  weekly: boolean;
}) {
  const t = COACH_TEXT[lang];
  const [items, setItems] = useState<{ id: string; text: string }[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState({ daily, weekly });
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) void listCoachMemories().then(setItems);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[92vw] max-w-md gap-5 overflow-y-auto p-5 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <div>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="size-5 text-brand-ink" /> {t.memoryTitle}
          </SheetTitle>
          <SheetDescription className="mt-1">{t.memoryHelp}</SheetDescription>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (!text) return;
            start(async () => {
              const r = await addCoachMemory(text);
              if (!r.ok) return setError(r.error);
              setError(null);
              setDraft("");
              setItems(await listCoachMemories());
            });
          }}
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.memoryPlaceholder} maxLength={300} aria-label={t.memoryAdd} />
          <Button type="submit" variant="brand" disabled={pending || !draft.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />} {t.memoryAdd}
          </Button>
        </form>
        {error && <p className="-mt-3 text-sm text-loss">{error}</p>}
        {items == null ? (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t.memoryEmpty}</p>
        ) : (
          <ul className="grid gap-1.5">
            {items.map((m) => (
              <li key={m.id} className="group flex items-start gap-2 rounded-lg border bg-card p-2.5 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                <span className="min-w-0 flex-1">{m.text}</span>
                <button
                  type="button"
                  aria-label={t.delete}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-loss"
                  onClick={() =>
                    start(async () => {
                      await deleteCoachMemory(m.id);
                      setItems((x) => x?.filter((i) => i.id !== m.id) ?? null);
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 border-t pt-4">
          <p className="font-medium">{AUTO[lang].title}</p>
          {(["daily", "weekly"] as const).map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--brand)]"
                checked={auto[k]}
                onChange={(e) => {
                  const v = e.target.checked;
                  setAuto((a) => ({ ...a, [k]: v }));
                  void saveCoachPrefs(k === "daily" ? { coachDailyReport: v } : { coachWeeklyReport: v });
                }}
              />
              {AUTO[lang][k]}
            </label>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
