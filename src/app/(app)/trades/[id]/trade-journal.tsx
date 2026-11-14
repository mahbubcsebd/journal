"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createSetup, createTag, deleteTrade, saveTradeJournal, type JournalInput } from "@/server/actions/trades";

type TagOpt = { id: string; name: string; kind: "TAG" | "MISTAKE" | "EMOTION"; color: string };

const SUGGESTED = {
  EMOTION: ["Calm", "Confident", "Focused", "Anxious", "Fearful", "Greedy", "Impatient", "Frustrated", "Bored", "Euphoric"],
  MISTAKE: ["FOMO entry", "No stop loss", "Moved stop loss", "Oversized", "Revenge trade", "Overtraded", "Early exit", "Ignored plan", "Chased price", "Late entry"],
  TAG: ["A+ setup", "News", "Trend", "Range", "Breakout", "Reversal", "Scalp", "Swing"],
};

function Chip({
  active,
  color,
  children,
  onClick,
  dashed,
}: {
  active?: boolean;
  color?: string;
  children: React.ReactNode;
  onClick: () => void;
  dashed?: boolean;
}) {
  return (
    <motion.button
      type="button"
      layout
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors",
        dashed && "border-dashed text-muted-foreground hover:text-foreground",
        !active && !dashed && "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
      style={
        active
          ? {
              background: `color-mix(in oklch, ${color ?? "var(--brand)"} 16%, transparent)`,
              borderColor: `color-mix(in oklch, ${color ?? "var(--brand)"} 45%, transparent)`,
              color: color ?? "var(--brand)",
            }
          : undefined
      }
    >
      {active && <Check className="size-3" />}
      {children}
    </motion.button>
  );
}

export function TradeJournal({
  tradeId,
  initial,
  tags: initialTags,
  setups: initialSetups,
}: {
  tradeId: string;
  initial: JournalInput;
  tags: TagOpt[];
  setups: { id: string; name: string }[];
}) {
  const [v, setV] = useState<JournalInput>(initial);
  const [tags, setTags] = useState(initialTags);
  const [setups, setSetups] = useState(initialSetups);
  const [newSetup, setNewSetup] = useState<string | null>(null);
  const [adding, setAdding] = useState<TagOpt["kind"] | null>(null);
  const [draftTag, setDraftTag] = useState("");
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const set = <K extends keyof JournalInput>(k: K, val: JournalInput[K]) => setV((s) => ({ ...s, [k]: val }));
  const toggleTag = (id: string) =>
    set("tagIds", v.tagIds.includes(id) ? v.tagIds.filter((x) => x !== id) : [...v.tagIds, id]);

  const ensureTag = (name: string, kind: TagOpt["kind"], select = true) =>
    startBusy(async () => {
      const existing = tags.find((t) => t.kind === kind && t.name.toLowerCase() === name.toLowerCase());
      const t = existing ?? (await createTag({ name, kind }));
      if (!existing) setTags((all) => [...all, t]);
      if (select && kind !== "EMOTION") setV((s) => ({ ...s, tagIds: s.tagIds.includes(t.id) ? s.tagIds : [...s.tagIds, t.id] }));
    });

  const save = () =>
    startSave(async () => {
      try {
        await saveTradeJournal(tradeId, v);
        toast.success("Journal saved");
      } catch {
        toast.error("Couldn't save. Please try again.");
      }
    });

  const tagGroup = (kind: "MISTAKE" | "TAG", title: string) => {
    const own = tags.filter((t) => t.kind === kind);
    const suggestions = SUGGESTED[kind].filter((s) => !own.some((t) => t.name.toLowerCase() === s.toLowerCase()));
    return (
      <div className="grid gap-2">
        <Label>{title}</Label>
        <div className="flex flex-wrap gap-1.5">
          {own.map((t) => (
            <Chip key={t.id} active={v.tagIds.includes(t.id)} color={t.color} onClick={() => toggleTag(t.id)}>
              {t.name}
            </Chip>
          ))}
          {own.length < 4 &&
            suggestions.slice(0, 6 - own.length).map((s) => (
              <Chip key={s} dashed onClick={() => ensureTag(s, kind)}>
                {s}
              </Chip>
            ))}
          {adding === kind ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draftTag.trim()) ensureTag(draftTag.trim(), kind);
                setDraftTag("");
                setAdding(null);
              }}
            >
              <Input
                autoFocus
                value={draftTag}
                onChange={(e) => setDraftTag(e.target.value)}
                onBlur={() => setAdding(null)}
                placeholder="New…"
                className="h-7 w-28 rounded-full px-2.5 text-xs"
              />
            </form>
          ) : (
            <Chip dashed onClick={() => setAdding(kind)}>
              <Plus className="size-3" /> Add
            </Chip>
          )}
        </div>
      </div>
    );
  };

  const emotions = [
    ...tags.filter((t) => t.kind === "EMOTION").map((t) => t.name),
    ...SUGGESTED.EMOTION.filter((s) => !tags.some((t) => t.kind === "EMOTION" && t.name === s)),
  ];

  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <p className="text-sm font-semibold">Journal</p>
          <p className="text-[13px] text-muted-foreground">What happened, and what you learned.</p>
        </div>
        {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid gap-5 p-5">
        <div className="grid gap-2">
          <Label>Execution rating</Label>
          <div className="flex gap-1" onMouseLeave={() => undefined}>
            {[1, 2, 3, 4, 5].map((n) => (
              <motion.button
                key={n}
                type="button"
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => set("rating", v.rating === n ? null : n)}
              >
                <Star
                  className={cn(
                    "size-6 transition-colors",
                    v.rating && n <= v.rating ? "fill-warning text-warning" : "text-muted-foreground/40",
                  )}
                />
              </motion.button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="setup">Setup</Label>
          {newSetup === null ? (
            <Select
              id="setup"
              value={v.setupId ?? ""}
              onChange={(e) => {
                if (e.target.value === "__new") setNewSetup("");
                else set("setupId", e.target.value || null);
              }}
            >
              <option value="">No setup</option>
              {setups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="__new">+ New setup…</option>
            </Select>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = newSetup.trim();
                if (!name) return setNewSetup(null);
                startBusy(async () => {
                  const s = await createSetup(name);
                  setSetups((all) => [...all, s]);
                  set("setupId", s.id);
                  setNewSetup(null);
                });
              }}
            >
              <Input autoFocus value={newSetup} onChange={(e) => setNewSetup(e.target.value)} placeholder="e.g. London breakout" />
              <Button type="submit" variant="secondary">
                Add
              </Button>
            </form>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(["emotionBefore", "emotionAfter"] as const).map((k) => (
            <div key={k} className="grid gap-2">
              <Label htmlFor={k}>{k === "emotionBefore" ? "Feeling before" : "Feeling after"}</Label>
              <Select
                id={k}
                value={v[k] ?? ""}
                onChange={(e) => {
                  const val = e.target.value || null;
                  set(k, val);
                  if (val) ensureTag(val, "EMOTION", false);
                }}
              >
                <option value="">—</option>
                {emotions.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        <div className="grid gap-2">
          <Label>Followed your plan?</Label>
          <div className="flex gap-1.5">
            {[
              { val: true, label: "Yes" },
              { val: false, label: "No" },
            ].map((o) => (
              <Chip
                key={o.label}
                active={v.followedPlan === o.val}
                color={o.val ? "var(--profit)" : "var(--loss)"}
                onClick={() => set("followedPlan", v.followedPlan === o.val ? null : o.val)}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </div>

        {tagGroup("MISTAKE", "Mistakes")}
        {tagGroup("TAG", "Tags")}

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="sl">Initial stop loss</Label>
            <Input
              id="sl"
              type="number"
              step="any"
              value={v.sl ?? ""}
              onChange={(e) => set("sl", e.target.value ? Number(e.target.value) : null)}
              placeholder="Used for R"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="backtest">Type</Label>
            <Select id="backtest" value={v.isBacktest ? "1" : "0"} onChange={(e) => set("isBacktest", e.target.value === "1")}>
              <option value="0">Live trade</option>
              <option value="1">Backtest (excluded from stats)</option>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            rows={6}
            value={v.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Why did you take it? What did price do? What would you do differently?"
            className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15"
          />
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-card/90 px-5 py-3 backdrop-blur">
        <Button
          variant="ghost"
          size="sm"
          className="text-loss hover:bg-loss-soft hover:text-loss"
          onClick={() => {
            if (confirm("Delete this trade? Re-importing the report would bring it back.")) startBusy(() => deleteTrade(tradeId));
          }}
        >
          <Trash2 /> Delete
        </Button>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {dirty && (
              <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-xs text-muted-foreground">
                Unsaved changes
              </motion.span>
            )}
          </AnimatePresence>
          <Button onClick={save} disabled={saving || !dirty}>
            {saving && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
