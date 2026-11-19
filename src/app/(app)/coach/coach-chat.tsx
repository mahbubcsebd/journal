"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  Bot,
  Check,
  Copy,
  History,
  Loader2,
  MessageSquarePlus,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CoachMarkdown } from "@/components/coach/coach-markdown";
import { Button } from "@/components/ui/button";
import { useConfirm, usePrompt } from "@/components/ui/confirm-dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { deleteConversation, renameConversation } from "@/server/actions/coach";
import type { CoachMessageView } from "@/server/queries/coach";

type Conv = { id: string; title: string; updatedAt: string };
type Msg = CoachMessageView & { error?: boolean };

const TOOL_LABEL: Record<string, string> = {
  get_performance: "Performance",
  list_trades: "Trades",
  get_trade: "Trade details",
  get_psychology: "Psychology",
  get_news: "News calendar",
  get_accounts: "Accounts",
  get_journal: "Journal",
};

const SUGGESTIONS = [
  { title: "Biggest mistakes", text: "What are my 3 biggest mistakes in the last 30 days, and how do I fix them?" },
  { title: "Losing trades", text: "Amar losing trade gula analyze kore bolo kothay vul hocche, table and chart diye dekhao." },
  { title: "News this week", text: "Which high-impact news is coming this week for my symbols, and how should I trade around it?" },
  { title: "Best time to trade", text: "Compare my sessions, weekdays and hours. When should I trade and when should I stay out?" },
  { title: "Psychology check", text: "Amar revenge trading, overtrading ar news trading er obostha ki? Honest feedback dao." },
  { title: "Open risk", text: "Show my open positions and account balances. Is my current risk okay?" },
  { title: "Last loss review", text: "Review my last losing trade in detail: what went wrong and what should I have done?" },
  { title: "Weekly plan", text: "Make me a concrete improvement plan with rules for next week based on my data." },
];

const THINKING = [
  "Reading your trades…",
  "Crunching your statistics…",
  "Checking your psychology patterns…",
  "Looking at the economic calendar…",
  "Writing your answer…",
];

export function CoachChat({
  ready,
  configured,
  currency,
  firstName,
  conversations: initialConvs,
  conversationId: initialId,
  initialMessages,
  ask,
}: {
  ready: boolean;
  configured: boolean;
  currency: string;
  firstName: string;
  conversations: Conv[];
  conversationId: string | null;
  initialMessages: CoachMessageView[];
  ask?: string;
}) {
  const router = useRouter();
  const [convs, setConvs] = useState(initialConvs);
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const askedRef = useRef(false);
  const touch = useMediaQuery("(pointer: coarse)");
  const disabled = !ready || !configured;

  const scrollToEnd = (smooth = true) =>
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" }));

  useEffect(() => {
    if (initialMessages.length) scrollToEnd(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || disabled) return;
    setInput("");
    setBusy(true);
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [...m.filter((x) => !x.error), { id: tempId, role: "user", content: message, toolsUsed: null }]);
    scrollToEnd();
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        conversationId?: string | null;
        message?: CoachMessageView;
        error?: string;
      };
      if (!res.ok || !data.message) throw new Error(data.error || "The coach couldn't answer. Please try again.");
      const id = data.conversationId!;
      if (!conversationId) {
        setConversationId(id);
        setConvs((c) => [{ id, title: message.slice(0, 80), updatedAt: new Date().toISOString() }, ...c]);
        // Keep the URL shareable without reloading the page.
        window.history.replaceState(null, "", `/coach?c=${id}`);
      } else {
        setConvs((c) => {
          const cur = c.find((x) => x.id === id);
          return cur ? [{ ...cur, updatedAt: new Date().toISOString() }, ...c.filter((x) => x.id !== id)] : c;
        });
      }
      setMessages((m) => [...m, data.message!]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: `err-${Date.now()}`, role: "assistant", content: e instanceof Error ? e.message : String(e), toolsUsed: null, error: true },
      ]);
    } finally {
      setBusy(false);
      scrollToEnd();
    }
  }

  // "Ask coach" links from other pages (?ask=…) send once.
  useEffect(() => {
    if (ask && !askedRef.current && !initialId && !disabled) {
      askedRef.current = true;
      window.history.replaceState(null, "", "/coach");
      void send(ask);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retry() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((m) => m.filter((x) => !x.error && x.id !== lastUser.id));
    void send(lastUser.content);
  }

  const list = (
    <ConversationList
      convs={convs}
      activeId={conversationId}
      onNavigate={() => setHistoryOpen(false)}
      onDeleted={(id) => {
        setConvs((c) => c.filter((x) => x.id !== id));
        if (id === conversationId) router.push("/coach");
      }}
      onRenamed={(id, title) => setConvs((c) => c.map((x) => (x.id === id ? { ...x, title } : x)))}
    />
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 grid max-h-[calc(100dvh-8rem)] gap-3">
          <Button asChild variant="outline" className="justify-start">
            <Link href="/coach">
              <MessageSquarePlus /> New chat
            </Link>
          </Button>
          <div className="min-h-0 overflow-y-auto">{list}</div>
        </div>
      </aside>

      <section className="flex min-h-[calc(100dvh-12rem)] min-w-0 flex-col">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Bot className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {conversationId ? (convs.find((c) => c.id === conversationId)?.title ?? "AI Coach") : "AI Coach"}
            </h1>
            <p className="text-xs text-muted-foreground">Answers from your own trades, journal, psychology and the news calendar.</p>
          </div>
          <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setHistoryOpen(true)} aria-label="Chat history">
            <History />
          </Button>
          <Button asChild variant="outline" size="icon" className="lg:hidden" aria-label="New chat">
            <Link href="/coach">
              <MessageSquarePlus />
            </Link>
          </Button>
        </div>

        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-sm gap-3 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
            <SheetTitle>Chats</SheetTitle>
            <Button asChild variant="outline" className="justify-start" onClick={() => setHistoryOpen(false)}>
              <Link href="/coach">
                <MessageSquarePlus /> New chat
              </Link>
            </Button>
            <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
          </SheetContent>
        </Sheet>

        {!ready && (
          <Notice title="One-time database step needed">
            Run the SQL in <code className="font-mono">drizzle/0008_ai_coach.sql</code> in the Supabase SQL Editor, then reload this page.
          </Notice>
        )}
        {ready && !configured && (
          <Notice title="AI isn't set up">
            Add <code className="font-mono">GEMINI_API_KEY</code> to your environment variables and redeploy.
          </Notice>
        )}

        <div className="flex-1">
          {messages.length === 0 && !busy ? (
            <Welcome firstName={firstName} onPick={(t) => void send(t)} disabled={disabled} />
          ) : (
            <div className="grid gap-5 pb-4">
              {messages.map((m) => (
                <Message key={m.id} m={m} currency={currency} onRetry={retry} />
              ))}
              {busy && <Thinking />}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-2 lg:bottom-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl border bg-card/95 p-2 shadow-pop backdrop-blur-xl focus-within:ring-2 focus-within:ring-ring/40">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !touch && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              maxLength={4000}
              disabled={disabled}
              placeholder="Ask about your trades, mistakes, news…"
              aria-label="Message the coach"
              className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted-foreground max-md:text-base"
            />
            <Button type="submit" variant="brand" size="icon" className="rounded-xl" disabled={!input.trim() || busy || disabled} aria-label="Send">
              {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground max-sm:hidden">
            Coach can make mistakes and has no live price feed. Educational only — not financial advice.
          </p>
        </form>
      </section>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm">
      <p className="font-medium text-warning-ink">{title}</p>
      <p className="mt-0.5 text-muted-foreground">{children}</p>
    </div>
  );
}

function Welcome({ firstName, onPick, disabled }: { firstName: string; onPick: (t: string) => void; disabled: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="py-6 sm:py-10">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink shadow-soft">
          <Sparkles className="size-7" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{firstName ? `Hi ${firstName}, ` : ""}how can I help you trade better?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          I look at your real trades, journal, psychology stats, accounts and the news calendar, then explain with charts, tables and
          cards. Ask in English, বাংলা or Banglish.
        </p>
      </div>
      <div className="mx-auto mt-8 grid max-w-3xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s.text)}
            className="group rounded-xl border bg-card p-3 text-left shadow-soft transition-colors hover:border-brand/50 hover:bg-accent disabled:opacity-50"
          >
            <p className="text-sm font-medium group-hover:text-brand-ink">{s.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.text}</p>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function Message({ m, currency, onRetry }: { m: Msg; currency: string; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  if (m.role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] whitespace-pre-wrap text-primary-foreground shadow-soft">
          {m.content}
        </div>
      </motion.div>
    );
  }
  if (m.error) {
    return (
      <div className="flex gap-3">
        <Avatar />
        <div className="rounded-2xl rounded-tl-md border border-loss/40 bg-loss-soft/50 px-4 py-3 text-sm">
          <p className="text-loss">{m.content}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
            <RotateCcw /> Try again
          </Button>
        </div>
      </div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        <CoachMarkdown text={m.content} currency={currency} />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {m.toolsUsed && m.toolsUsed.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1">
              Looked at
              {m.toolsUsed.map((t) => (
                <span key={t} className="rounded-full border bg-card px-2 py-0.5">
                  {TOOL_LABEL[t] ?? t}
                </span>
              ))}
            </span>
          )}
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-accent hover:text-foreground"
            onClick={() => {
              void navigator.clipboard?.writeText(m.content).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Avatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
      <Bot className="size-4.5" />
    </div>
  );
}

function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, THINKING.length - 1)), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex gap-3" role="status" aria-live="polite">
      <Avatar />
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft">
        <span className="flex gap-1">
          {[0, 1, 2].map((d) => (
            <motion.span
              key={d}
              className="size-1.5 rounded-full bg-brand"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.2 }}
            />
          ))}
        </span>
        <AnimatePresence mode="wait">
          <motion.span key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            {THINKING[i]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ConversationList({
  convs,
  activeId,
  onNavigate,
  onDeleted,
  onRenamed,
}: {
  convs: Conv[];
  activeId: string | null;
  onNavigate: () => void;
  onDeleted: (id: string) => void;
  onRenamed: (id: string, title: string) => void;
}) {
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [, start] = useTransition();
  if (!convs.length) return <p className="px-2 py-4 text-sm text-muted-foreground">No chats yet.</p>;
  return (
    <ul className="grid gap-0.5">
      {convs.map((c) => (
        <li key={c.id} className="group relative">
          <Link
            href={`/coach?c=${c.id}`}
            onClick={onNavigate}
            className={cn(
              "block truncate rounded-lg py-2 pr-16 pl-3 text-sm transition-colors hover:bg-accent",
              c.id === activeId ? "bg-accent font-medium text-foreground" : "text-foreground/80",
            )}
          >
            {c.title}
          </Link>
          <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">
            <button
              type="button"
              aria-label="Rename chat"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
              onClick={async () => {
                const title = await prompt({ title: "Rename chat", defaultValue: c.title, confirmLabel: "Save" });
                if (!title?.trim()) return;
                start(async () => {
                  const r = await renameConversation(c.id, title);
                  if (r.ok) onRenamed(c.id, title.trim().slice(0, 80));
                });
              }}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete chat"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-loss"
              onClick={async () => {
                const ok = await confirm({ title: "Delete this chat?", description: c.title, confirmLabel: "Delete", destructive: true });
                if (!ok) return;
                start(async () => {
                  const r = await deleteConversation(c.id);
                  if (r.ok) onDeleted(c.id);
                });
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
