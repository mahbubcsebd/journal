"use client";

import { motion } from "motion/react";
import { Archive, Check, MoreHorizontal, Pencil, Plug, RefreshCw, Trash2, Unplug, Wallet, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TradingAccount } from "@/db/schema";
import { cn, formatMoney, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { disconnectAccount, syncAccountNow } from "@/server/actions/sync";
import { ConnectDialog, type KeyInfo } from "./connect-dialog";
import { archiveAccount, deleteAccount, renameAccount } from "@/server/actions/accounts";
import { isAutoName } from "@/lib/account-name";
import { AccountDialog } from "./account-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";

const STATUS: Record<TradingAccount["status"], { label: string; variant: "profit" | "loss" | "warning" | "default" }> = {
  CONNECTED: { label: "Connected", variant: "profit" },
  SYNCING: { label: "Syncing", variant: "warning" },
  ERROR: { label: "Error", variant: "loss" },
  DISCONNECTED: { label: "Disconnected", variant: "default" },
  PENDING: { label: "Not connected", variant: "default" },
};

const DOT: Record<TradingAccount["status"], string> = {
  CONNECTED: "bg-profit",
  SYNCING: "bg-warning",
  ERROR: "bg-loss",
  DISCONNECTED: "bg-muted-foreground/50",
  PENDING: "bg-muted-foreground/50",
};

const METHOD: Record<TradingAccount["syncMethod"], string> = {
  EA: "MT5 EA",
  METAAPI: "MetaApi",
  IMPORT: "Imported",
  MANUAL: "Manual",
  SMC: "SMC Desk",
};

function ago(iso: Date | string | null) {
  if (!iso) return null;
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

export function AccountList({
  accounts,
  keys,
  origin,
  metaApi,
}: {
  accounts: TradingAccount[];
  keys: KeyInfo[];
  origin: string;
  metaApi: boolean;
}) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<TradingAccount | null>(null);
  const [now] = useState(() => Date.now());
  const [syncing, setSyncing] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (accounts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card/60 px-6 py-16 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
          <Wallet className="size-6" />
        </span>
        <div className="grid max-w-md gap-1.5">
          <h2 className="text-lg font-semibold tracking-tight">Add your first Exness account</h2>
          <p className="text-sm text-muted-foreground">
            Add each MT5 login from your Exness Personal Area. You&apos;ll find the login number and server under
            <span className="text-foreground"> My accounts → Account information</span>.
          </p>
        </div>
        <AccountDialog />
      </motion.div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a, i) => {
          const status = STATUS[a.status];
          const floating = a.balance != null && a.equity != null ? Math.round((a.equity - a.balance) * 100) / 100 : null;
          const open = a.openPositions?.length ?? 0;
          const live = a.status === "CONNECTED" && a.lastSyncAt != null && now - new Date(a.lastSyncAt).getTime() < 10 * 60_000;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
              <Card className="group relative h-full overflow-hidden p-0 transition-shadow hover:shadow-pop">
                {/* Soft wash of the account colour instead of a hard top stripe. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-28 -right-20 size-64 rounded-full opacity-[0.14] blur-3xl transition-opacity group-hover:opacity-[0.22] dark:opacity-[0.18]"
                  style={{ background: a.color }}
                />
                <div className="relative grid gap-5 p-5">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-soft ring-1 ring-black/5 ring-inset"
                      style={{ background: `linear-gradient(135deg, ${a.color}, color-mix(in oklch, ${a.color} 70%, black))` }}
                    >
                      {isAutoName(a.nickname, a.login) ? a.login.slice(-2) : initials(a.nickname)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <AccountName account={a} />
                      <p className="truncate font-mono text-xs text-muted-foreground tabular">
                        #{a.login} · {a.server}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Options for ${a.nickname}`}
                        className="-mt-1 -mr-1 rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(a)}>
                          <Pencil /> Edit details
                        </DropdownMenuItem>
                        {(a.syncMethod === "EA" || a.syncMethod === "METAAPI") && (
                          <DropdownMenuItem
                            onSelect={async () => {
                              const ok = await confirm({
                                title: `Stop auto-sync for ${a.nickname}?`,
                                description: "Trades already synced stay in your journal.",
                                confirmLabel: "Stop auto-sync",
                              });
                              if (!ok) return;
                              startTransition(async () => {
                                await disconnectAccount(a.id);
                                toast.success("Auto-sync stopped");
                              });
                            }}
                          >
                            <Unplug /> Stop auto-sync
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onSelect={() =>
                            startTransition(async () => {
                              await archiveAccount(a.id);
                              toast.success(`${a.nickname} archived`);
                            })
                          }
                        >
                          <Archive /> Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-loss [&_svg]:!text-loss"
                          onSelect={async () => {
                            const ok = await confirm({
                              title: `Delete ${a.nickname}?`,
                              description: "All of its trades are deleted too. This cannot be undone.",
                              destructive: true,
                            });
                            if (!ok) return;
                            startTransition(async () => {
                              await deleteAccount(a.id);
                              toast.success(`${a.nickname} deleted`);
                            });
                          }}
                        >
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="truncate font-mono text-2xl font-semibold tracking-tight tabular">
                        {a.balance != null ? formatMoney(a.balance, a.currency) : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Equity</p>
                      <p className="font-mono text-sm font-medium tabular">{a.equity != null ? formatMoney(a.equity, a.currency) : "—"}</p>
                      {floating != null && floating !== 0 && (
                        <p className={cn("font-mono text-xs font-medium tabular", floating > 0 ? "text-profit" : "text-loss")}>
                          {formatMoney(floating, a.currency, { sign: true })} floating
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground/90">
                      <span className="relative flex size-2">
                        {live && <span className="absolute inset-0 animate-ping rounded-full bg-profit/60" />}
                        <span className={cn("relative size-2 rounded-full", DOT[a.status])} />
                      </span>
                      {status.label}
                    </span>
                    <span aria-hidden>·</span>
                    <span suppressHydrationWarning>{a.lastSyncAt ? `Synced ${ago(a.lastSyncAt)}` : "Never synced"}</span>
                    {open > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{open} open</span>
                      </>
                    )}
                  </div>
                  {a.status === "ERROR" && a.statusMessage && <p className="-mt-3 text-xs text-loss">{a.statusMessage}</p>}
                  {a.status === "SYNCING" && a.statusMessage && <p className="-mt-3 text-xs text-muted-foreground">{a.statusMessage}</p>}

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{a.accountType}</Badge>
                    <Badge variant={a.environment === "DEMO" ? "warning" : "brand"}>{a.environment === "DEMO" ? "Demo" : "Real"}</Badge>
                    {a.currency === "USC" && <Badge variant="outline">Cent</Badge>}
                    <Badge variant="outline">{METHOD[a.syncMethod]}</Badge>
                  </div>
                </div>

                <div className="relative flex items-center gap-2 border-t bg-muted/30 px-5 py-3">
                  {a.syncMethod === "METAAPI" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={syncing === a.id}
                      onClick={() => {
                        setSyncing(a.id);
                        startTransition(async () => {
                          const r = await syncAccountNow(a.id);
                          setSyncing(null);
                          if (r.ok) toast.success(r.message);
                          else toast.error(r.message);
                        });
                      }}
                    >
                      <RefreshCw className={cn(syncing === a.id && "animate-spin")} /> Sync now
                    </Button>
                  ) : null}
                  <ConnectDialog
                    account={a}
                    keys={keys}
                    origin={origin}
                    metaApi={metaApi}
                    trigger={
                      <Button size="sm" variant={a.syncMethod === "EA" || a.syncMethod === "METAAPI" ? "ghost" : "default"} className="ml-auto">
                        <Plug /> {a.syncMethod === "EA" || a.syncMethod === "METAAPI" ? "Sync settings" : "Connect auto-sync"}
                      </Button>
                    }
                  />
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
      {editing && (
        <AccountDialog key={editing.id} account={editing} open onOpenChange={(o) => !o && setEditing(null)} />
      )}
    </>
  );
}

/** The account's name, renamable in place. Accounts the EA added get a nudge to name them. */
function AccountName({ account }: { account: TradingAccount }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(account.nickname);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const auto = isAutoName(account.nickname, account.login);

  const save = () => {
    const next = value.trim();
    if (!next || next === account.nickname) return setEditing(false);
    start(async () => {
      const r = await renameAccount(account.id, next);
      if (r.ok) {
        toast.success("Account renamed");
        setEditing(false);
      } else toast.error(r.error);
    });
  };

  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          ref={input}
          autoFocus
          value={value}
          maxLength={40}
          disabled={pending}
          aria-label="Account name"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setValue(account.nickname);
              setEditing(false);
            }
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm font-semibold outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15"
        />
        <button type="submit" aria-label="Save name" className="rounded-md p-1.5 text-profit hover:bg-accent">
          <Check className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Cancel"
          onClick={() => {
            setValue(account.nickname);
            setEditing(false);
          }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      </form>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <p className="truncate font-semibold tracking-tight">{account.nickname}</p>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Rename ${account.nickname}`}
        className={cn(
          "shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground",
          auto ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        <Pencil className="size-3.5" />
      </button>
      {auto && (
        <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-[11px] font-medium text-brand-ink hover:underline">
          Name it
        </button>
      )}
    </div>
  );
}
