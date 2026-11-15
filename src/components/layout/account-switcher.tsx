"use client";

import { Check, ChevronsUpDown, Layers, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { setAccountFilter } from "@/server/actions/account-filter";

export type SwitcherAccount = {
  id: string;
  nickname: string;
  login: string;
  accountType: string;
  environment: "REAL" | "DEMO";
  color: string;
};

export function AccountSwitcher({
  accounts,
  selected,
  isAll,
}: {
  accounts: SwitcherAccount[];
  selected: string[];
  isAll: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic({ selected, isAll });

  const apply = (ids: string[]) => {
    const all = ids.length === 0 || ids.length === accounts.length;
    startTransition(async () => {
      setOptimistic({ selected: all ? accounts.map((a) => a.id) : ids, isAll: all });
      await setAccountFilter(all ? [] : ids);
    });
  };

  const toggle = (id: string) => {
    const base = optimistic.isAll ? [] : optimistic.selected;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    apply(next);
  };

  const only = accounts.find((a) => a.id === optimistic.selected[0]);
  const label = accounts.length === 0
    ? "No accounts"
    : optimistic.isAll
      ? "All accounts"
      : optimistic.selected.length === 1 && only
        ? only.nickname
        : `${optimistic.selected.length} accounts`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        aria-label="Accounts shown"
        className={cn(
          "inline-flex h-9 max-w-[220px] items-center gap-2 rounded-lg border bg-card px-2.5 text-[13px] font-medium shadow-xs transition outline-none hover:bg-accent focus-visible:ring-4 focus-visible:ring-ring/15",
          pending && "opacity-70",
        )}
      >
        {optimistic.isAll || !only || optimistic.selected.length > 1 ? (
          <Layers className="size-4 text-muted-foreground" />
        ) : (
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: only.color }} />
        )}
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command loop>
          {accounts.length > 5 && <CommandInput placeholder="Search accounts…" />}
          <CommandList className="max-h-80">
            <CommandEmpty>No accounts found.</CommandEmpty>
            <CommandGroup heading="Show data from">
              <CommandItem value="__all__" keywords={["All accounts"]} onSelect={() => apply([])}>
                <Layers />
                <span className="flex-1">All accounts</span>
                <Check className={cn("!text-foreground", optimistic.isAll ? "opacity-100" : "opacity-0")} />
              </CommandItem>
            </CommandGroup>
            {accounts.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  {accounts.map((a) => {
                    const checked = !optimistic.isAll && optimistic.selected.includes(a.id);
                    return (
                      <CommandItem
                        key={a.id}
                        value={a.id}
                        keywords={[a.nickname, a.login, a.accountType]}
                        onSelect={() => toggle(a.id)}
                        aria-checked={checked}
                      >
                        <span
                          className={cn(
                            "grid size-4 shrink-0 place-items-center rounded border",
                            checked ? "border-foreground bg-foreground text-background" : "border-input",
                          )}
                        >
                          {checked && <Check className="size-3 !text-background" />}
                        </span>
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate">{a.nickname}</span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            #{a.login} · {a.accountType}
                          </span>
                        </span>
                        {a.environment === "DEMO" && (
                          <span className="rounded bg-warning/15 px-1 text-[10px] font-medium text-warning-ink">DEMO</span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__manage__"
                keywords={["Manage accounts"]}
                onSelect={() => {
                  setOpen(false);
                  router.push("/accounts");
                }}
              >
                <Plus /> Manage accounts
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
