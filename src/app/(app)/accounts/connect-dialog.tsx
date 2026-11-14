"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Cloud, Copy, Cpu, Download, KeyRound, Loader2, Plug, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import type { TradingAccount } from "@/db/schema";
import { cn } from "@/lib/utils";
import { createSyncKey, revokeSyncKey } from "@/server/actions/sync-keys";
import { connectMetaApiAccount } from "@/server/actions/sync";

export type KeyInfo = { id: string; name: string; prefix: string; lastUsedAt: string | null; revoked: boolean };

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{n}</span>
      <div className="grid gap-1.5 pb-1">
        <p className="text-sm font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

export function ConnectDialog({
  account,
  keys,
  origin,
  metaApi,
  trigger,
}: {
  account: TradingAccount;
  keys: KeyInfo[];
  origin: string;
  metaApi: boolean;
  trigger: React.ReactNode;
}) {
  const [tab, setTab] = useState<"ea" | "metaapi">(account.syncMethod === "METAAPI" ? "metaapi" : "ea");
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  const active = keys.filter((k) => !k.revoked);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Auto-sync {account.nickname}</DialogTitle>
          <DialogDescription>
            #{account.login} · {account.server}. Pick how trades should reach your journal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {[
            { k: "ea" as const, icon: Cpu, title: "MT5 Expert Advisor", sub: "Free · instant · MT5 must be running" },
            { k: "metaapi" as const, icon: Cloud, title: "MetaApi cloud", sub: "Works with your PC off · paid service" },
          ].map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => setTab(o.k)}
              className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition", tab === o.k ? "border-brand bg-brand-soft/50" : "hover:border-foreground/25")}
            >
              <o.icon className={cn("mt-0.5 size-5", tab === o.k ? "text-brand" : "text-muted-foreground")} />
              <span className="grid">
                <span className="text-sm font-medium">{o.title}</span>
                <span className="text-xs text-muted-foreground">{o.sub}</span>
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "ea" ? (
            <motion.ol key="ea" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-4">
              <Step n={1} title="Create a sync key">
                {key ? (
                  <div className="grid gap-1.5">
                    <div className="flex gap-2">
                      <Input readOnly value={key} className="h-9 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Sync key" />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9"
                        onClick={async () => {
                          await navigator.clipboard.writeText(key);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                      >
                        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <p className="text-xs text-warning">Copy it now — it won&apos;t be shown again. One key works for all your MT5 accounts.</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => setKey(await createSyncKey()))}>
                      {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Generate key
                    </Button>
                    {active.length > 0 && <span className="text-xs text-muted-foreground">You already have {active.length} active key{active.length > 1 ? "s" : ""} — you can reuse it.</span>}
                  </div>
                )}
              </Step>
              <Step n={2} title="Download the EA">
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <a href="/api/ea/download" download>
                    <Download /> JournalSync.mq5
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground">In MT5: File → Open Data Folder → MQL5 → Experts. Put the file there, then right-click Expert Advisors in the Navigator → Refresh (or open it in MetaEditor and press F7).</p>
              </Step>
              <Step n={3} title="Allow the EA to reach Journal">
                <p className="text-xs text-muted-foreground">
                  Tools → Options → Expert Advisors → tick <b>Allow WebRequest for listed URL</b> and add:
                </p>
                <code className="w-fit rounded-md bg-muted px-2 py-1 font-mono text-xs">{origin}</code>
              </Step>
              <Step n={4} title="Attach it to any chart">
                <p className="text-xs text-muted-foreground">
                  Drag JournalSync onto one chart, paste the key in Inputs, and make sure Algo Trading is on. The chart shows “Journal sync: synced …”. It sends the last 90 days, then every new deal within seconds. It only reads — it never trades.
                </p>
              </Step>
              <Step n={5} title="Other Exness sub-accounts">
                <p className="text-xs text-muted-foreground">Log in to another account in the same MT5 (or another terminal) with the EA attached — new logins are added to Journal automatically.</p>
              </Step>
            </motion.ol>
          ) : (
            <motion.div key="metaapi" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-4">
              {!metaApi ? (
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
                  <p className="font-medium">MetaApi isn&apos;t set up on this server</p>
                  <p className="mt-1 text-muted-foreground">
                    Create an account at metaapi.cloud, copy your API token and add it as <code className="rounded bg-muted px-1">METAAPI_TOKEN</code> in the Vercel environment variables, then redeploy.
                  </p>
                </div>
              ) : account.metaapiAccountId ? (
                <p className="rounded-xl border bg-profit-soft/50 p-4 text-sm">This account is connected to MetaApi. Use “Sync now” on the account card, or disconnect it from the ⋯ menu.</p>
              ) : (
                <form
                  className="grid gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    start(async () => {
                      const r = await connectMetaApiAccount(account.id, password);
                      setPassword("");
                      if (r.ok) toast.success(r.message);
                      else toast.error(r.message);
                    });
                  }}
                >
                  <Field
                    label="Investor password (read-only)"
                    htmlFor="investor"
                    hint="Exness Personal Area → your account → ⋯ → Change investor password. Never use your trading password — the investor password can't place trades."
                  >
                    <Input id="investor" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    The password goes straight to MetaApi to connect a cloud terminal and isn&apos;t stored by Journal. MetaApi bills per connected account.
                  </p>
                  <Button type="submit" disabled={pending} className="w-fit">
                    {pending ? <Loader2 className="animate-spin" /> : <Plug />} Connect with MetaApi
                  </Button>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {tab === "ea" && keys.length > 0 && (
          <div className="grid gap-2 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">Your sync keys</p>
            {keys.map((k) => (
              <div key={k.id} className={cn("flex items-center gap-3 rounded-lg border px-3 py-2 text-xs", k.revoked && "opacity-50")}>
                <span className="font-mono">{k.prefix}…</span>
                <span className="text-muted-foreground">
                  {k.revoked ? "Revoked" : k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleString()}` : "Never used"}
                </span>
                {!k.revoked && (
                  <button
                    type="button"
                    className="ml-auto inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-loss-soft hover:text-loss"
                    onClick={() => confirm("Revoke this key? EAs using it will stop syncing.") && start(() => revokeSyncKey(k.id))}
                  >
                    <Trash2 className="size-3.5" /> Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
