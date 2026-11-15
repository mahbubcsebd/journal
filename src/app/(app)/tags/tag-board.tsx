"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { deleteTag, updateTag } from "@/server/actions/tags";
import { createTag } from "@/server/actions/trades";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Tag = {
  id: string;
  name: string;
  kind: "TAG" | "MISTAKE" | "EMOTION";
  color: string;
  trades: number;
  wins: number;
  netPnl: number;
};

const COLUMNS = [
  { kind: "TAG", title: "Tags", hint: "Context, strategy, market conditions" },
  { kind: "MISTAKE", title: "Mistakes", hint: "Rule breaks you want to stop making" },
  { kind: "EMOTION", title: "Emotions", hint: "How you felt before or after a trade" },
] as const;

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6", "#ef4444", "#84cc16", "#64748b"];

export function TagBoard({ tags, currency }: { tags: Tag[]; currency: string }) {
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>({});

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      {COLUMNS.map((col, ci) => {
        const list = tags.filter((t) => t.kind === col.kind).sort((a, b) => b.trades - a.trades || a.name.localeCompare(b.name));
        return (
          <motion.div key={col.kind} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.05 }}>
            <Card className="overflow-hidden">
              <div className="border-b px-5 py-4">
                <p className="text-sm font-semibold">{col.title}</p>
                <p className="text-[13px] text-muted-foreground">{col.hint}</p>
              </div>
              <ul className="divide-y">
                <AnimatePresence initial={false}>
                  {list.map((t) => (
                    <motion.li
                      key={t.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="group flex items-center gap-3 px-5 py-2.5"
                    >
                      <button
                        type="button"
                        aria-label="Change colour"
                        className="size-3 shrink-0 rounded-full ring-offset-2 ring-offset-card transition hover:ring-2 hover:ring-border"
                        style={{ background: t.color }}
                        onClick={() =>
                          start(async () => {
                            await updateTag(t.id, { color: PALETTE[(PALETTE.indexOf(t.color) + 1) % PALETTE.length] });
                          })
                        }
                      />
                      <input
                        defaultValue={t.name}
                        aria-label="Tag name"
                        className="min-w-0 flex-1 truncate rounded bg-transparent text-sm outline-none focus:bg-muted focus:px-1"
                        onBlur={(e) => {
                          const name = e.target.value.trim();
                          if (!name || name === t.name) return (e.target.value = t.name);
                          start(async () => {
                            const res = await updateTag(t.id, { name });
                            if (res?.error) {
                              toast.error(res.error);
                              e.target.value = t.name;
                            }
                          });
                        }}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      />
                      <span className="text-xs text-muted-foreground tabular">
                        {t.trades} {t.trades === 1 ? "trade" : "trades"}
                        {t.trades > 0 && ` · ${formatPercent(t.wins / t.trades, 0)}`}
                      </span>
                      <span
                        className={cn(
                          "w-24 text-right font-mono text-[13px] font-medium tabular",
                          t.netPnl > 0 ? "text-profit" : t.netPnl < 0 ? "text-loss" : "text-muted-foreground",
                        )}
                      >
                        {t.trades ? formatMoney(t.netPnl, currency, { sign: true }) : "—"}
                      </span>
                      <button
                        type="button"
                        aria-label={`Delete ${t.name}`}
                        className="rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-loss-soft hover:text-loss focus:opacity-100"
                        onClick={async () => {
                          const ok = await confirm({ title: `Delete "${t.name}"?`, description: "It will be removed from all trades.", destructive: true });
                          if (ok) start(() => deleteTag(t.id));
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
                {list.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted-foreground">Nothing here yet</li>}
              </ul>
              <form
                className="flex items-center gap-2 border-t px-5 py-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = (draft[col.kind] ?? "").trim();
                  if (!name) return;
                  start(async () => {
                    await createTag({ name, kind: col.kind });
                    setDraft((d) => ({ ...d, [col.kind]: "" }));
                  });
                }}
              >
                <Plus className="size-4 text-muted-foreground" />
                <Input
                  value={draft[col.kind] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [col.kind]: e.target.value }))}
                  placeholder={`New ${col.title.toLowerCase().replace(/s$/, "")}…`}
                  disabled={pending}
                  className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </form>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
