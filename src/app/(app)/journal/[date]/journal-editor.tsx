"use client";

import { motion } from "motion/react";
import { Check, Pencil, Plus, Sunrise, Sunset, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RichEditor } from "@/components/editor/rich-editor";
import { SaveIndicator } from "@/components/editor/save-status";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useAutosave } from "@/hooks/use-autosave";
import type { DocNode } from "@/lib/doc";
import { BIAS, MOODS } from "@/lib/journal";
import { cn } from "@/lib/utils";
import { deleteJournal, saveChecklistTemplate, saveJournal, type JournalInput } from "@/server/actions/journal";

type State = JournalInput;

function Section({ icon: Icon, title, hint, children, delay = 0 }: { icon: typeof Sunrise; title: string; hint: string; children: React.ReactNode; delay?: number }) {
  return (
    <FadeIn delay={delay}>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-[13px] text-muted-foreground">{hint}</p>
          </div>
        </div>
        <div className="grid gap-5 p-5">{children}</div>
      </Card>
    </FadeIn>
  );
}

export function JournalEditor({
  day,
  initial,
  checklistTemplate,
  exists,
}: {
  day: string;
  initial: State;
  checklistTemplate: string[];
  exists: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<State>(initial);
  const [template, setTemplate] = useState(checklistTemplate);
  const [editingList, setEditingList] = useState(false);
  const [draftItem, setDraftItem] = useState("");
  const [, start] = useTransition();
  const status = useAutosave(v, (val) => saveJournal(day, val));

  const pre = v.premarket;
  const rev = v.review;
  const setPre = (patch: Partial<State["premarket"]>) => setV((s) => ({ ...s, premarket: { ...s.premarket, ...patch } }));
  const setRev = (patch: Partial<State["review"]>) => setV((s) => ({ ...s, review: { ...s.review, ...patch } }));
  const checklist = pre.checklist ?? {};
  const done = template.filter((t) => checklist[t]).length;

  const persistTemplate = (items: string[]) => {
    setTemplate(items);
    start(async () => {
      await saveChecklistTemplate(items);
    });
  };

  return (
    <div className="grid gap-6">
      <div className="flex min-h-5 items-center justify-end">
        <SaveIndicator status={status} />
      </div>

      <Section icon={Sunrise} title="Before the session" hint="Bias, checklist and the plan you'll hold yourself to.">
        <div className="grid gap-2">
          <Label>Market bias</Label>
          <div className="inline-flex w-fit rounded-lg border bg-card p-0.5">
            {BIAS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => setPre({ bias: pre.bias === b.value ? null : b.value })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[13px] font-medium transition",
                  pre.bias === b.value
                    ? b.value === "BULLISH"
                      ? "bg-profit-soft text-profit"
                      : b.value === "BEARISH"
                        ? "bg-loss-soft text-loss"
                        : "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>
              Checklist <span className="ml-1 font-normal text-muted-foreground tabular">{done}/{template.length}</span>
            </Label>
            <Button variant="ghost" size="sm" onClick={() => setEditingList((e) => !e)}>
              {editingList ? <Check /> : <Pencil />} {editingList ? "Done" : "Edit list"}
            </Button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-brand"
              animate={{ width: `${template.length ? (done / template.length) * 100 : 0}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
            />
          </div>
          <ul className="grid gap-1">
            {template.map((item) => (
              <li key={item} className="flex items-center gap-2">
                {editingList ? (
                  <>
                    <span className="flex-1 rounded-lg border px-3 py-2 text-sm">{item}</span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${item}`} onClick={() => persistTemplate(template.filter((t) => t !== item))}>
                      <X />
                    </Button>
                  </>
                ) : (
                  <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={Boolean(checklist[item])}
                      onChange={(e) => setPre({ checklist: { ...checklist, [item]: e.target.checked } })}
                      className="size-4 accent-[var(--brand)]"
                    />
                    <span className={cn(checklist[item] && "text-muted-foreground line-through")}>{item}</span>
                  </label>
                )}
              </li>
            ))}
          </ul>
          {editingList && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = draftItem.trim();
                if (!t || template.includes(t)) return;
                persistTemplate([...template, t]);
                setDraftItem("");
              }}
            >
              <Input value={draftItem} onChange={(e) => setDraftItem(e.target.value)} placeholder="Add a checklist item" className="h-9" />
              <Button type="submit" variant="secondary" size="sm" className="h-9">
                <Plus /> Add
              </Button>
            </form>
          )}
        </div>

        <div className="grid gap-2">
          <Label>Plan</Label>
          <RichEditor
            value={(pre.plan as DocNode) ?? null}
            onChange={(plan) => setPre({ plan })}
            placeholder="Key levels, news, which setups you're looking for, what would make you stop for the day…"
            minHeight={140}
            ariaLabel="Pre-market plan"
          />
        </div>
      </Section>

      <Section icon={Sunset} title="After the session" hint="Be honest — this is where the improvement happens." delay={0.05}>
        <div className="grid gap-2">
          <Label>How did you feel today?</Label>
          <div className="flex gap-2">
            {MOODS.map((m) => (
              <motion.button
                key={m.value}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setV((s) => ({ ...s, mood: s.mood === m.value ? null : m.value }))}
                aria-pressed={v.mood === m.value}
                className={cn(
                  "flex w-16 flex-col items-center gap-1 rounded-xl border py-2 text-xs transition",
                  v.mood === m.value ? "border-brand bg-brand-soft text-foreground" : "text-muted-foreground hover:border-foreground/25",
                )}
              >
                <span className={cn("text-2xl transition", v.mood !== m.value && v.mood != null && "opacity-40 grayscale")}>{m.emoji}</span>
                {m.label}
              </motion.button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label>What went well</Label>
            <RichEditor value={(rev.wentWell as DocNode) ?? null} onChange={(wentWell) => setRev({ wentWell })} placeholder="Good decisions, patience, rules you followed…" toolbar={false} minHeight={110} ariaLabel="What went well" />
          </div>
          <div className="grid gap-2">
            <Label>What to improve</Label>
            <RichEditor value={(rev.improve as DocNode) ?? null} onChange={(improve) => setRev({ improve })} placeholder="Mistakes, missed trades, emotional moments…" toolbar={false} minHeight={110} ariaLabel="What to improve" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Lessons</Label>
          <RichEditor value={(rev.lessons as DocNode) ?? null} onChange={(lessons) => setRev({ lessons })} placeholder="One thing to remember tomorrow." minHeight={90} ariaLabel="Lessons" />
        </div>
      </Section>

      {exists && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-loss hover:bg-loss-soft hover:text-loss"
            onClick={() => {
              if (!confirm("Delete this journal entry?")) return;
              start(async () => {
                await deleteJournal(day);
                toast.success("Entry deleted");
                router.push("/journal");
              });
            }}
          >
            <Trash2 /> Delete entry
          </Button>
        </div>
      )}
    </div>
  );
}
