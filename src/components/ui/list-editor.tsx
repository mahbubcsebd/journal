"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";

/** Editable ordered list of short strings (rules, checklist items). */
export function ListEditor({
  items,
  onChange,
  placeholder,
  numbered,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  numbered?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const move = (i: number, d: number) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1.5">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.li
              key={`${i}-${item}`}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="group flex items-center gap-2"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold text-muted-foreground tabular">
                {numbered ? i + 1 : "•"}
              </span>
              <Input
                defaultValue={item}
                aria-label={`Item ${i + 1}`}
                onBlur={(e) => {
                  const t = e.target.value.trim();
                  if (!t) onChange(items.filter((_, j) => j !== i));
                  else if (t !== item) onChange(items.map((x, j) => (j === i ? t : x)));
                }}
                className="h-9"
              />
              <div className="flex opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t) return;
          onChange([...items, t]);
          setDraft("");
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="h-9" />
        <Button type="submit" variant="secondary" size="sm" className="h-9">
          <Plus /> Add
        </Button>
      </form>
    </div>
  );
}
