"use client";

import { Check, ChevronsUpDown, Layers, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useState, useTransition } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ResponsivePopover } from "@/components/ui/responsive-popover";
import { cn } from "@/lib/utils";
import { setAccountFilter } from "@/server/actions/account-filter";
import { useT } from "@/components/i18n/t";

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
  const t = useT();
  const listId = useId();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic({ selected, isAll });

  /** `[]` means all accounts; anything else is an explicit selection. */
  const apply = (ids: string[]) => {
    const all = ids.length === 0;
    startTransition(async () => {
      setOptimistic({ selected: all ? accounts.map((a) => a.id) : ids, isAll: all });
      await setAccountFilter(ids);
    });
  };

  /** Tap an account: show only that one. */
  const only = (id: string) => {
    setOpen(false);
    apply([id]);
  };

  const toggle = (id: string) => {
    const base = optimistic.isAll ? [] : optimistic.selected;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    apply(next);
  };

  const single = !optimistic.isAll && optimistic.selected.length === 1 ? accounts.find((a) => a.id === optimistic.selected[0]) : undefined;
  const label = accounts.length === 0
    ? t("No accounts")
    : optimistic.isAll
      ? t("All accounts")
      : single
        ? single.nickname
        : `${optimistic.selected.length} accounts`;

  return (
    <ResponsivePopover
      open={open}
      onOpenChange={setOpen}
      title="Show data from"
      id={listId}
      className="w-72"
      trigger={
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label="Accounts shown"
          className={cn(
            "inline-flex h-9 min-w-0 max-w-[104px] items-center sm:max-w-[220px] gap-2 rounded-lg border bg-card px-2.5 text-[13px] font-medium shadow-xs transition outline-none hover:bg-accent focus-visible:ring-4 focus-visible:ring-ring/15",
            pending && "opacity-70",
          )}
        >
          {single ? (
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: single.color }} />
          ) : (
            <Layers className="size-4 text-muted-foreground" />
          )}
          {/* Very narrow phones: icon only, so the news countdown still fits. */}
          <span className="truncate max-[389px]:sr-only">{label}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      }
    >
        <Command loop>
          {accounts.length > 5 && <CommandInput placeholder="Search accounts…" />}
          <CommandList className="max-h-80">
            <CommandEmpty>No accounts found.</CommandEmpty>
            <CommandGroup heading="Show data from">
              <CommandItem
                value="__all__"
                keywords={["All accounts"]}
                onSelect={() => {
                  setOpen(false);
                  apply([]);
                }}
              >
                <Layers />
                <span className="flex-1">{t("All accounts")}</span>
                <Check className={cn("!text-foreground", optimistic.isAll ? "opacity-100" : "opacity-0")} />
              </CommandItem>
            </CommandGroup>
            {accounts.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={accounts.length > 1 ? "Tap to switch · tick boxes to combine" : undefined}>
                  {accounts.map((a) => {
                    const checked = !optimistic.isAll && optimistic.selected.includes(a.id);
                    return (
                      <CommandItem
                        key={a.id}
                        value={a.id}
                        keywords={[a.nickname, a.login, a.accountType]}
                        onSelect={() => only(a.id)}
                        aria-selected={checked}
                        className="py-2"
                      >
                        {accounts.length > 1 && (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            aria-label={`Combine ${a.nickname}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(a.id);
                            }}
                            className={cn(
                              "-m-1.5 grid size-7 shrink-0 place-items-center rounded-md hover:bg-background/60",
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-4 place-items-center rounded border",
                                checked ? "border-foreground bg-foreground text-background" : "border-input",
                              )}
                            >
                              {checked && <Check className="size-3 !text-background" />}
                            </span>
                          </button>
                        )}
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
                        {single?.id === a.id && <Check className="!text-foreground" />}
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
    </ResponsivePopover>
  );
}
