"use client";

import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { motion } from "motion/react";
import {
  Bot,
  CalendarPlus,
  FilePlus2,
  FolderInput,
  Keyboard,
  Layers,
  LogOut,
  Moon,
  Plus,
  Search,
  Target,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";
import { cn, formatMoney } from "@/lib/utils";
import { setAccountFilter } from "@/server/actions/account-filter";
import { createNote } from "@/server/actions/notes";
import { searchTrades } from "@/server/actions/search";
import { ALL_NAV_ITEMS } from "./nav-config";

type Account = { id: string; nickname: string; login: string; color: string };
type Hit = Awaited<ReturnType<typeof searchTrades>>[number];

/** "g" then one of these keys jumps to a page. */
export const GO_KEYS: Record<string, string> = {
  d: "/dashboard",
  c: "/calendar",
  t: "/trades",
  a: "/analytics",
  r: "/reports",
  j: "/journal",
  n: "/notebook",
  p: "/playbook",
  g: "/goals",
  i: "/insights",
  s: "/settings",
};

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{children}</kbd>;
}

export function CommandMenu({ accounts, today }: { accounts: Account[]; today: string }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<"root" | "shortcuts">("root");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, startSearch] = useTransition();
  const goPending = useRef<number | null>(null);

  const show = (p: "root" | "shortcuts" = "root") => {
    setPage(p);
    setQuery("");
    setHits([]);
    setOpen(true);
  };

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (open) setOpen(false);
      else show();
      return;
    }
    if (open || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (goPending.current != null) {
      const href = GO_KEYS[e.key.toLowerCase()];
      window.clearTimeout(goPending.current);
      goPending.current = null;
      if (href) {
        e.preventDefault();
        router.push(href);
      }
      return;
    }
    if (e.key === "g") goPending.current = window.setTimeout(() => (goPending.current = null), 1200);
    else if (e.key === "/") {
      e.preventDefault();
      show();
    } else if (e.key === "?") show("shortcuts");
    else if (e.key === "N") router.push("/trades/new");
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const t = setTimeout(() => startSearch(async () => setHits(await searchTrades(query))), 180);
    return () => clearTimeout(t);
  }, [query]);

  const run = (fn: () => void | Promise<void>) => {
    setOpen(false);
    void fn();
  };

  const item = "flex cursor-default select-none items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none data-[selected=true]:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground";
  const group = "px-1 py-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";

  return (
    <>
      <button
        type="button"
        onClick={() => show()}
        className="hidden h-9 w-56 items-center gap-2 rounded-lg border bg-card px-3 text-[13px] text-muted-foreground shadow-xs transition hover:bg-accent md:inline-flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <button type="button" onClick={() => show()} aria-label="Search" className="rounded-lg p-2 text-muted-foreground hover:bg-accent md:hidden">
        <Search className="size-4" />
      </button>

      <D.Root open={open} onOpenChange={setOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_120ms_ease-out]" />
          <D.Content
            aria-describedby={undefined}
            className="fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border bg-popover shadow-pop outline-none"
          >
            <D.Title className="sr-only">Command menu</D.Title>
            <motion.div initial={{ opacity: 0, scale: 0.98, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}>
              {page === "shortcuts" ? (
                <div className="grid gap-4 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Keyboard shortcuts</p>
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setPage("root")}>
                      Back
                    </button>
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    {[
                      ["Open this menu", "⌘K  or  /"],
                      ["Show shortcuts", "?"],
                      ["Add a trade", "Shift N"],
                      ...Object.entries(GO_KEYS).map(([k, href]) => [`Go to ${ALL_NAV_ITEMS.find((n) => n.href === href)?.label ?? href}`, `G  ${k.toUpperCase()}`]),
                      ["Previous / next period (calendar)", "←  →"],
                    ].map(([label, keys]) => (
                      <div key={label} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                        <span className="text-muted-foreground">{label}</span>
                        <Kbd>{keys}</Kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Command loop shouldFilter label="Command menu" className="flex max-h-[min(70vh,520px)] flex-col">
                  <div className="flex items-center gap-2 border-b px-4">
                    <Search className="size-4 text-muted-foreground" />
                    <Command.Input
                      value={query}
                      onValueChange={setQuery}
                      placeholder="Search trades by symbol, setup or note — or type a command"
                      className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                    />
                    {searching && <span className="size-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />}
                  </div>
                  <Command.List className="overflow-y-auto p-1.5">
                    <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">No results.</Command.Empty>
                    {hits.length > 0 && (
                      <Command.Group heading="Trades" className={group}>
                        {hits.map((h) => (
                          <Command.Item key={h.id} value={`trade ${h.id} ${query}`} onSelect={() => run(() => router.push(`/trades/${h.id}`))} className={item}>
                            <span className={cn("rounded px-1 text-[10px] font-semibold", h.side === "LONG" ? "bg-profit-soft text-profit" : "bg-loss-soft text-loss")}>
                              {h.side === "LONG" ? "L" : "S"}
                            </span>
                            <span className="font-medium">{h.symbol}</span>
                            {h.setupName && <span className="truncate text-xs text-muted-foreground">{h.setupName}</span>}
                            <span className="ml-auto text-xs text-muted-foreground tabular">{new Date(h.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                            <span className={cn("w-24 text-right font-mono text-xs font-semibold tabular", h.status === "OPEN" ? "text-muted-foreground" : h.netPnl >= 0 ? "text-profit" : "text-loss")}>
                              {formatMoney(h.netPnl, h.currency, { sign: true })}
                            </span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                    <Command.Group heading="Actions" className={group}>
                      <Command.Item onSelect={() => run(() => router.push("/trades/new"))} className={item}>
                        <Plus /> Add a trade <span className="ml-auto"><Kbd>⇧N</Kbd></span>
                      </Command.Item>
                      <Command.Item onSelect={() => run(() => router.push("/import"))} className={item}>
                        <FolderInput /> Import MT5 history
                      </Command.Item>
                      <Command.Item onSelect={() => run(() => router.push(`/journal/${today}`))} className={item}>
                        <CalendarPlus /> Today&apos;s journal
                      </Command.Item>
                      <Command.Item
                        onSelect={() =>
                          run(async () => {
                            const id = await createNote({});
                            router.push(`/notebook?id=${id}`);
                          })
                        }
                        className={item}
                      >
                        <FilePlus2 /> New note
                      </Command.Item>
                      <Command.Item onSelect={() => run(() => router.push("/goals"))} className={item}>
                        <Target /> Set a goal
                      </Command.Item>
                      <Command.Item onSelect={() => run(() => router.push("/insights"))} className={item}>
                        <Bot /> Get an AI review
                      </Command.Item>
                      <Command.Item onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))} className={item}>
                        <Moon /> Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
                      </Command.Item>
                      <Command.Item onSelect={() => setPage("shortcuts")} className={item}>
                        <Keyboard /> Keyboard shortcuts <span className="ml-auto"><Kbd>?</Kbd></span>
                      </Command.Item>
                    </Command.Group>
                    <Command.Group heading="Go to" className={group}>
                      {ALL_NAV_ITEMS.map((n) => {
                        const key = Object.entries(GO_KEYS).find(([, h]) => h === n.href)?.[0];
                        return (
                          <Command.Item key={n.href} value={`go ${n.label}`} onSelect={() => run(() => router.push(n.href))} className={item}>
                            <n.icon /> {n.label}
                            {key && <span className="ml-auto"><Kbd>G {key.toUpperCase()}</Kbd></span>}
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                    {accounts.length > 1 && (
                      <Command.Group heading="Show accounts" className={group}>
                        <Command.Item value="accounts all" onSelect={() => run(async () => { await setAccountFilter([]); toast.success("Showing all accounts"); })} className={item}>
                          <Layers /> All accounts
                        </Command.Item>
                        {accounts.map((a) => (
                          <Command.Item
                            key={a.id}
                            value={`account ${a.nickname} ${a.login}`}
                            onSelect={() => run(async () => { await setAccountFilter([a.id]); toast.success(`Showing ${a.nickname}`); })}
                            className={item}
                          >
                            <span className="size-2.5 rounded-full" style={{ background: a.color }} /> {a.nickname}
                            <span className="ml-auto text-xs text-muted-foreground">#{a.login}</span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                    <Command.Group heading="Account" className={group}>
                      <Command.Item
                        onSelect={() =>
                          run(async () => {
                            await signOut();
                            router.replace("/login");
                            router.refresh();
                          })
                        }
                        className={item}
                      >
                        <LogOut /> Sign out
                      </Command.Item>
                    </Command.Group>
                  </Command.List>
                  <div className="flex items-center gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground">
                    <span><Kbd>↑↓</Kbd> navigate</span>
                    <span><Kbd>↵</Kbd> open</span>
                    <span><Kbd>esc</Kbd> close</span>
                  </div>
                </Command>
              )}
            </motion.div>
          </D.Content>
        </D.Portal>
      </D.Root>
    </>
  );
}
