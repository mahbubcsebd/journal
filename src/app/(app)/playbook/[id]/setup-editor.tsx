"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { SaveIndicator } from "@/components/editor/save-status";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { ListEditor } from "@/components/ui/list-editor";
import { useAutosave } from "@/hooks/use-autosave";
import { ACCOUNT_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { deletePlaybookSetup, updatePlaybookSetup } from "@/server/actions/playbook";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Setup = { id: string; name: string; description: string | null; color: string; rules: string[]; checklist: string[] };

export function SetupEditor({ setup }: { setup: Setup }) {
  const confirm = useConfirm();
  const [v, setV] = useState({ name: setup.name, description: setup.description ?? "", color: setup.color, rules: setup.rules, checklist: setup.checklist });
  const [, start] = useTransition();
  const status = useAutosave(v, (val) => updatePlaybookSetup(setup.id, { ...val, name: val.name.trim() || "Untitled setup", description: val.description || null }));
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <FadeIn>
      <Card className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: v.color }} />
        <div className="grid gap-6 p-6">
          <div className="flex items-start justify-between gap-3">
            <input
              value={v.name}
              onChange={(e) => set("name", e.target.value)}
              aria-label="Setup name"
              className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none"
            />
            <SaveIndicator status={status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                onClick={() => set("color", c)}
                className={cn("size-6 rounded-full ring-offset-2 ring-offset-card transition", v.color === c ? "ring-2 ring-foreground" : "hover:scale-110")}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="desc">Description</Label>
            <textarea
              id="desc"
              rows={3}
              value={v.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Market conditions, timeframe, what the setup looks like…"
              className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15"
            />
          </div>
          <div className="grid gap-2">
            <Label>Rules</Label>
            <ListEditor items={v.rules} onChange={(rules) => set("rules", rules)} placeholder="e.g. Only trade with the 4H trend" numbered />
          </div>
          <div className="grid gap-2">
            <Label>Entry checklist</Label>
            <ListEditor items={v.checklist} onChange={(checklist) => set("checklist", checklist)} placeholder="e.g. Price closed above the range high" />
          </div>
          <div className="flex justify-end border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-loss hover:bg-loss-soft hover:text-loss"
              onClick={async () =>
                (await confirm({ title: `Delete "${v.name}"?`, description: "Trades keep their data but lose this setup.", destructive: true })) &&
                start(() => deletePlaybookSetup(setup.id))
              }
            >
              <Trash2 /> Delete setup
            </Button>
          </div>
        </div>
      </Card>
    </FadeIn>
  );
}
