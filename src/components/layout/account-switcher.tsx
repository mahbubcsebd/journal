"use client";

import { Check, ChevronsUpDown, Layers, Plus } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-9 max-w-[220px] items-center gap-2 rounded-lg border bg-card px-2.5 text-[13px] font-medium shadow-xs transition hover:bg-accent",
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Show data from</DropdownMenuLabel>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); apply([]); }}>
          <Layers />
          <span className="flex-1">All accounts</span>
          {optimistic.isAll && <Check className="!text-foreground" />}
        </DropdownMenuItem>
        {accounts.length > 0 && <DropdownMenuSeparator />}
        {accounts.map((a) => (
          <DropdownMenuCheckboxItem
            key={a.id}
            checked={!optimistic.isAll && optimistic.selected.includes(a.id)}
            onSelect={(e) => {
              e.preventDefault();
              toggle(a.id);
            }}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
            <span className="grid min-w-0 flex-1">
              <span className="truncate">{a.nickname}</span>
              <span className="truncate text-[11px] text-muted-foreground">
                #{a.login} · {a.accountType}
              </span>
            </span>
            {a.environment === "DEMO" && (
              <span className="rounded bg-warning/15 px-1 text-[10px] font-medium text-warning">DEMO</span>
            )}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/accounts">
            <Plus /> Manage accounts
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
