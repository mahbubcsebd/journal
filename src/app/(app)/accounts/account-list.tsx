"use client";

import { motion } from "motion/react";
import { Archive, MoreHorizontal, Pencil, Plug, PlugZap, RefreshCw, Server, Trash2, Unplug, Wallet } from "lucide-react";
import { useState, useTransition } from "react";
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
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { disconnectAccount, syncAccountNow } from "@/server/actions/sync";
import { ConnectDialog, type KeyInfo } from "./connect-dialog";
import { archiveAccount, deleteAccount } from "@/server/actions/accounts";
import { AccountDialog } from "./account-dialog";

const STATUS: Record<TradingAccount["status"], { label: string; variant: "profit" | "loss" | "warning" | "default" }> = {
  CONNECTED: { label: "Connected", variant: "profit" },
  SYNCING: { label: "Syncing", variant: "warning" },
  ERROR: { label: "Error", variant: "loss" },
  DISCONNECTED: { label: "Disconnected", variant: "default" },
  PENDING: { label: "Not connected", variant: "default" },
};

const METHOD: Record<TradingAccount["syncMethod"], string> = {
  EA: "MT5 EA",
  METAAPI: "MetaApi",
  IMPORT: "Imported",
  MANUAL: "Manual",
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
  const [editing, setEditing] = useState<TradingAccount | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (accounts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card/60 px-6 py-16 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
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
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className="group relative overflow-hidden p-5 transition hover:shadow-pop">
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: a.color }} />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
                      style={{ background: a.color }}
                    >
                      {a.nickname.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold tracking-tight">{a.nickname}</p>
                      <p className="font-mono text-xs text-muted-foreground tabular">#{a.login}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(a)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      {(a.syncMethod === "EA" || a.syncMethod === "METAAPI") && (
                        <DropdownMenuItem
                          onSelect={() => {
                            if (!confirm(`Stop auto-sync for ${a.nickname}? Trades already synced stay in your journal.`)) return;
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
                        onSelect={() => {
                          if (!confirm(`Delete ${a.nickname} and all of its trades? This cannot be undone.`)) return;
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

                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Badge variant="outline">{a.accountType}</Badge>
                  <Badge variant={a.environment === "DEMO" ? "warning" : "brand"}>{a.environment === "DEMO" ? "Demo" : "Real"}</Badge>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <Badge variant="outline">{METHOD[a.syncMethod]}</Badge>
                </div>
                {a.status === "ERROR" && a.statusMessage && <p className="mt-2 text-xs text-loss">{a.statusMessage}</p>}
                {a.status === "SYNCING" && a.statusMessage && <p className="mt-2 text-xs text-muted-foreground">{a.statusMessage}</p>}

                <dl className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Balance</dt>
                    <dd className="font-mono font-medium tabular">
                      {a.balance != null ? formatMoney(a.balance, a.currency) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Equity</dt>
                    <dd className="font-mono font-medium tabular">
                      {a.equity != null ? formatMoney(a.equity, a.currency) : "—"}
                    </dd>
                  </div>
                  <div className="col-span-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Server className="size-3.5" /> {a.server}
                    <span className="mx-1">·</span>
                    <PlugZap className="size-3.5" />
                    <span suppressHydrationWarning>{a.lastSyncAt ? `Synced ${ago(a.lastSyncAt)}` : "Not synced yet"}</span>
                    {(a.openPositions?.length ?? 0) > 0 && <span>· {a.openPositions!.length} open</span>}
                  </div>
                </dl>
                <div className="mt-4 flex gap-2">
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
                      <Button size="sm" variant={a.syncMethod === "EA" || a.syncMethod === "METAAPI" ? "ghost" : "default"}>
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
