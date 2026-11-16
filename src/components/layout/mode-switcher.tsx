"use client";

import { Check, ChevronsUpDown, FlaskConical, Layers2, Radio } from "lucide-react";
import { useId, useOptimistic, useState, useTransition } from "react";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { ResponsivePopover } from "@/components/ui/responsive-popover";
import type { DataMode } from "@/lib/session";
import { cn } from "@/lib/utils";
import { setDataMode } from "@/server/actions/account-filter";

const MODES: { value: DataMode; label: string; hint: string; icon: typeof Radio }[] = [
  { value: "live", label: "Live", hint: "Real trades only", icon: Radio },
  { value: "backtest", label: "Backtest", hint: "Only trades marked as backtest", icon: FlaskConical },
  { value: "all", label: "All", hint: "Live and backtest together", icon: Layers2 },
];

/** Live / Backtest / All — which trades every stats page uses. */
export function ModeSwitcher({ mode }: { mode: DataMode }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [current, setCurrent] = useOptimistic(mode);
  const listId = useId();
  const active = MODES.find((m) => m.value === current) ?? MODES[0];

  return (
    <ResponsivePopover
      open={open}
      onOpenChange={setOpen}
      title="Show trades from"
      id={listId}
      className="w-64"
      trigger={
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={`Data: ${active.label}`}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[13px] font-medium shadow-xs transition outline-none hover:bg-accent focus-visible:ring-4 focus-visible:ring-ring/15",
            current === "backtest" && "border-warning/50 bg-warning/10 text-warning-ink",
            current === "all" && "border-brand/40 bg-brand-soft/60 text-brand-ink",
            pending && "opacity-70",
          )}
        >
          <active.icon className="size-4" />
          <span className="hidden sm:inline">{active.label}</span>
          <ChevronsUpDown className="hidden size-3.5 text-muted-foreground sm:block" />
        </button>
      }
    >
      <Command>
        <CommandList>
          <CommandGroup heading="Show trades from">
            {MODES.map((m) => (
              <CommandItem
                key={m.value}
                value={m.value}
                onSelect={() => {
                  setOpen(false);
                  start(async () => {
                    setCurrent(m.value);
                    await setDataMode(m.value);
                  });
                }}
              >
                <m.icon />
                <span className="grid flex-1">
                  <span>{m.label}</span>
                  <span className="text-[11px] text-muted-foreground">{m.hint}</span>
                </span>
                <Check className={cn("!text-foreground", m.value === current ? "opacity-100" : "opacity-0")} />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </ResponsivePopover>
  );
}
