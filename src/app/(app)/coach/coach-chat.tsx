"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  Bot,
  Brain,
  CalendarCheck,
  CalendarRange,
  Check,
  Copy,
  History,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Mic,
  NotebookPen,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CoachMarkdown } from "@/components/coach/coach-markdown";
import { CoachSettings } from "@/components/coach/coach-settings";
import { COACH_TEXT, type CoachLang, type CoachText } from "@/components/coach/i18n";
import { PreTradeDialog, type PreTradeAccount } from "@/components/coach/pretrade-dialog";
import { Button } from "@/components/ui/button";
import { useConfirm, usePrompt } from "@/components/ui/confirm-dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { CoachStreamEvent } from "@/app/api/coach/route";
import { deleteConversation, rateCoachMessage, renameConversation, saveCoachAnswerToNotebook, saveCoachPrefs } from "@/server/actions/coach";
import type { CoachMessageView } from "@/server/queries/coach";

type Conv = { id: string; title: string; updatedAt: string };
type Msg = CoachMessageView & { error?: boolean; stopped?: boolean };
type Img = { mimeType: "image/jpeg"; data: string; preview: string };
type ReplyLang = "auto" | "en" | "bn";

/** Clear the sticky top bar when scrolling a message into view. */
const SCROLL_MT = "scroll-mt-[calc(4.5rem+env(safe-area-inset-top))] lg:scroll-mt-24";

/** Screenshot → JPEG at most 1600px wide, so uploads stay small and fast. */
async function toJpeg(file: File): Promise<Img> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { mimeType: "image/jpeg", data: url.split(",")[1], preview: url };
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechCtor = new () => SpeechRec;
const speechApi = (): SpeechCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export function CoachChat({
  ready,
  configured,
  currency,
  firstName,
  conversations: initialConvs,
  conversationId: initialId,
  initialMessages,
  ask,
  replyLang: initialReplyLang,
  accounts,
  symbols,
  dailyReport,
  weeklyReport,
}: {
  ready: boolean;
  configured: boolean;
  currency: string;
  firstName: string;
  conversations: Conv[];
  conversationId: string | null;
  initialMessages: CoachMessageView[];
  ask?: string;
  replyLang: ReplyLang;
  accounts: PreTradeAccount[];
  symbols: string[];
  dailyReport: boolean;
  weeklyReport: boolean;
}) {
  const router = useRouter();
  const [convs, setConvs] = useState(initialConvs);
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<Img[]>([]);
  const [imgError, setImgError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ text: string; tools: string[] } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preTradeOpen, setPreTradeOpen] = useState(false);
  const [replyLang, setReplyLang] = useState<ReplyLang>(initialReplyLang);
  const [reviewing, setReviewing] = useState<null | "daily" | "weekly">(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const scrollTarget = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const askedRef = useRef(false);
  const touch = useMediaQuery("(pointer: coarse)");
  // Speech recognition exists only in some browsers (Chrome, Edge, Safari).
  const canSpeak = useMediaQuery("(min-width: 0px)") && Boolean(speechApi());
  const disabled = !ready || !configured;
  const lang: CoachLang = replyLang === "bn" ? "bn" : "en";
  const t = COACH_TEXT[lang];

  // Opening a saved chat: start at the latest message.
  useEffect(() => {
    if (initialMessages.length) window.scrollTo({ top: document.documentElement.scrollHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chat-app scrolling: a sent question moves to the top of the screen, and an
  // answer is shown from its first line, so nothing hides behind the input box.
  useEffect(() => {
    const target = scrollTarget.current;
    if (!target) return;
    // Once per message: a second run mid-animation measures the wrong spot.
    scrollTarget.current = null;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-msg="${CSS.escape(target)}"]`);
      if (el) {
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - margin, behavior: "smooth" });
      }
    });
  }, [messages]);

  function rememberConversation(id: string, title: string) {
    if (!conversationId) {
      setConversationId(id);
      setConvs((c) => [{ id, title: title.slice(0, 80), updatedAt: new Date().toISOString() }, ...c.filter((x) => x.id !== id)]);
      // Keep the URL shareable without reloading the page.
      window.history.replaceState(null, "", `/coach?c=${id}`);
    } else {
      setConvs((c) => {
        const cur = c.find((x) => x.id === id);
        return cur ? [{ ...cur, updatedAt: new Date().toISOString() }, ...c.filter((x) => x.id !== id)] : c;
      });
    }
  }

  async function send(text: string, attach: Img[] = images) {
    const message = text.trim();
    if ((!message && attach.length === 0) || busy || disabled) return;
    recRef.current?.stop();
    setInput("");
    setImages([]);
    setBusy(true);
    setLive({ text: "", tools: [] });
    const tempId = `tmp-${Date.now()}`;
    scrollTarget.current = tempId;
    setMessages((m) => [
      ...m.filter((x) => !x.error),
      { id: tempId, role: "user", content: message, toolsUsed: null, images: attach.length, previews: attach.map((i) => i.preview) },
    ]);
    const ctl = new AbortController();
    abortRef.current = ctl;
    let written = "";
    const tools: string[] = [];
    let done = false;
    let cid = conversationId;
    const fail = (error: string) => {
      const errId = `err-${Date.now()}`;
      scrollTarget.current = errId;
      setMessages((m) => [...m, { id: errId, role: "assistant", content: error, toolsUsed: null, error: true }]);
    };
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message, images: attach.map(({ mimeType, data }) => ({ mimeType, data })) }),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "The coach couldn't answer. Please try again.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += value;
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          const e = JSON.parse(line) as CoachStreamEvent;
          if (e.type === "meta") {
            cid = e.conversationId;
          } else if (e.type === "tool") {
            tools.push(e.name);
            setLive({ text: written, tools: [...tools] });
          } else if (e.type === "text") {
            written += e.text;
            setLive({ text: written, tools: [...tools] });
          } else if (e.type === "done") {
            done = true;
            if (cid) rememberConversation(cid, message || "📈 Chart review");
            scrollTarget.current = e.message.id;
            setMessages((m) => [...m, e.message]);
          } else if (e.type === "error") {
            done = true;
            fail(e.error);
          }
        }
      }
      if (!done) throw new Error("The connection dropped before the answer finished. Please try again.");
    } catch (e) {
      if (ctl.signal.aborted) {
        // Stopped by the user: keep what was written so far.
        if (cid) rememberConversation(cid, message || "📈 Chart review");
        if (written) setMessages((m) => [...m, { id: `stop-${Date.now()}`, role: "assistant", content: written, toolsUsed: tools, stopped: true }]);
      } else if (!done) fail(e instanceof Error ? e.message : String(e));
    } finally {
      abortRef.current = null;
      setLive(null);
      setBusy(false);
    }
  }

  // "Ask coach" links from other pages (?ask=…) send once.
  useEffect(() => {
    if (ask && !askedRef.current && !initialId && !disabled) {
      askedRef.current = true;
      window.history.replaceState(null, "", "/coach");
      void send(ask, []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retry() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((m) => m.filter((x) => !x.error && x.id !== lastUser.id));
    void send(lastUser.content, []);
  }

  async function addFiles(files: FileList | File[]) {
    setImgError(null);
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (images.length + list.length > 3) setImgError(t.maxImages);
    const room = Math.max(0, 3 - images.length);
    try {
      const out = await Promise.all(list.slice(0, room).map(toJpeg));
      setImages((x) => [...x, ...out].slice(0, 3));
    } catch {
      setImgError(t.imageTooBig);
    }
  }

  function toggleVoice() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Api = speechApi();
    if (!Api) return;
    const rec = new Api();
    rec.lang = lang === "bn" ? "bn-BD" : "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    const base = input ? input.trimEnd() + " " : "";
    rec.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      setInput(base + said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function review(kind: "daily" | "weekly") {
    setReviewing(kind);
    setReviewError(null);
    setHistoryOpen(false);
    try {
      const res = await fetch("/api/coach/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, today: kind === "daily" }),
      });
      const data = (await res.json().catch(() => ({}))) as { conversationId?: string; error?: string };
      if (!res.ok || !data.conversationId) throw new Error(data.error || "Couldn't build the review.");
      router.push(`/coach?c=${data.conversationId}`);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : String(e));
    } finally {
      setReviewing(null);
    }
  }

  const sidebar = (
    <>
      <div className="grid gap-1.5">
        <Button asChild variant="outline" className="justify-start" onClick={() => setHistoryOpen(false)}>
          <Link href="/coach">
            <MessageSquarePlus /> {t.newChat}
          </Link>
        </Button>
        <Button
          variant="outline"
          className="justify-start"
          onClick={() => {
            setHistoryOpen(false);
            setPreTradeOpen(true);
          }}
          disabled={!accounts.length}
        >
          <ShieldCheck className="text-brand-ink" /> {t.preTrade}
        </Button>
      </div>
      <div className="grid gap-1">
        <p className="px-1 text-xs font-medium text-muted-foreground">{t.reviews}</p>
        <Button variant="ghost" size="sm" className="justify-start" disabled={disabled || reviewing != null} onClick={() => void review("daily")}>
          {reviewing === "daily" ? <Loader2 className="animate-spin" /> : <CalendarCheck />} {t.reviewToday}
        </Button>
        <Button variant="ghost" size="sm" className="justify-start" disabled={disabled || reviewing != null} onClick={() => void review("weekly")}>
          {reviewing === "weekly" ? <Loader2 className="animate-spin" /> : <CalendarRange />} {t.reviewWeek}
        </Button>
        {reviewing && <p className="px-2 text-xs text-muted-foreground">{t.reviewing}</p>}
        {reviewError && <p className="px-2 text-xs text-loss">{reviewError}</p>}
      </div>
      <div className="grid min-h-0 content-start gap-1">
        <p className="px-1 text-xs font-medium text-muted-foreground">{t.chats}</p>
        <div className="min-h-0 overflow-y-auto">
          <ConversationList
            t={t}
            convs={convs}
            activeId={conversationId}
            onNavigate={() => setHistoryOpen(false)}
            onDeleted={(id) => {
              setConvs((c) => c.filter((x) => x.id !== id));
              if (id === conversationId) router.push("/coach");
            }}
            onRenamed={(id, title) => setConvs((c) => c.map((x) => (x.id === id ? { ...x, title } : x)))}
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 grid max-h-[calc(100dvh-8rem)] grid-rows-[auto_auto_minmax(0,1fr)] gap-4">{sidebar}</div>
      </aside>

      <section className="flex min-h-[calc(100dvh-12rem)] min-w-0 flex-col">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Bot className="size-5" />
          </div>
          <div className="min-w-[min(14rem,70%)] flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {conversationId ? (convs.find((c) => c.id === conversationId)?.title ?? t.title) : t.title}
            </h1>
            <p className="truncate text-xs text-muted-foreground">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-1.5 max-sm:w-full max-sm:justify-end">
            <LangSwitch
              value={replyLang}
              t={t}
              onChange={(v) => {
                setReplyLang(v);
                void saveCoachPrefs({ coachLanguage: v });
              }}
            />
            <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)} aria-label={t.memory} title={t.memoryTitle}>
              <Brain />
            </Button>
            <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setPreTradeOpen(true)} aria-label={t.preTrade} disabled={!accounts.length}>
              <ShieldCheck />
            </Button>
            <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setHistoryOpen(true)} aria-label={t.history}>
              <History />
            </Button>
          </div>
        </div>

        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-sm gap-4 overflow-y-auto p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
            <SheetTitle>{t.chats}</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>
        <CoachSettings open={settingsOpen} onOpenChange={setSettingsOpen} lang={lang} daily={dailyReport} weekly={weeklyReport} />
        {accounts.length > 0 && <PreTradeDialog open={preTradeOpen} onOpenChange={setPreTradeOpen} accounts={accounts} symbols={symbols} lang={lang} />}

        {!ready && (
          <Notice title={t.dbStep}>
            <code className="font-mono">drizzle/0008_ai_coach.sql</code> + <code className="font-mono">drizzle/0009_coach_plus.sql</code> {t.dbStepText}
          </Notice>
        )}
        {ready && !configured && (
          <Notice title={t.noAi}>
            <code className="font-mono">GEMINI_API_KEY</code> {t.noAiText}
          </Notice>
        )}

        <div className="flex-1">
          {messages.length === 0 && !busy ? (
            <Welcome t={t} firstName={firstName} onPick={(q) => void send(q, [])} disabled={disabled} />
          ) : (
            <div className="grid gap-5 pb-4">
              {messages.map((m) => (
                <Message key={m.id} m={m} t={t} lang={lang} currency={currency} onRetry={retry} />
              ))}
              {busy && live && (
                <>
                  <Live live={live} t={t} lang={lang} currency={currency} />
                  {/* Room below so the question can scroll to the top while waiting. */}
                  {!live.text && <div aria-hidden className="h-[55dvh]" />}
                </>
              )}
            </div>
          )}
        </div>

        <form
          className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-2 lg:bottom-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
          }}
        >
          <div className="rounded-2xl border bg-card/95 p-2 shadow-pop backdrop-blur-xl focus-within:ring-2 focus-within:ring-ring/40">
            {images.length > 0 && (
              <div className="flex gap-2 px-1 pt-1 pb-2">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt="" className="size-16 rounded-lg border object-cover" />
                    <button
                      type="button"
                      aria-label={t.removeImage}
                      onClick={() => setImages((x) => x.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 rounded-full border bg-background p-0.5 shadow-soft"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl"
                onClick={() => fileRef.current?.click()}
                disabled={disabled || busy}
                aria-label={t.attach}
                title={t.attach}
              >
                <ImagePlus />
              </Button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={(e) => {
                  const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
                  if (files.length) {
                    e.preventDefault();
                    void addFiles(files);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !touch && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                maxLength={4000}
                disabled={disabled}
                placeholder={listening ? t.listening : t.placeholder}
                aria-label={t.placeholder}
                className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-muted-foreground max-md:text-base"
              />
              {canSpeak && (
                <Button
                  type="button"
                  variant={listening ? "destructive" : "ghost"}
                  size="icon"
                  className={cn("rounded-xl", listening && "animate-pulse")}
                  onClick={toggleVoice}
                  disabled={disabled || busy}
                  aria-label={listening ? t.listening : t.voice}
                  title={t.voice}
                >
                  <Mic />
                </Button>
              )}
              {busy ? (
                <Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={() => abortRef.current?.abort()} aria-label={t.stop}>
                  <Square className="fill-current" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="brand"
                  size="icon"
                  className="rounded-xl"
                  disabled={(!input.trim() && !images.length) || disabled}
                  aria-label={t.send}
                >
                  <ArrowUp />
                </Button>
              )}
            </div>
          </div>
          {imgError && <p className="mt-1 text-center text-xs text-loss">{imgError}</p>}
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground max-sm:hidden">{t.disclaimer}</p>
        </form>
      </section>
    </div>
  );
}

function LangSwitch({ value, onChange, t }: { value: ReplyLang; onChange: (v: ReplyLang) => void; t: CoachText }) {
  const opts: [ReplyLang, string][] = [
    ["auto", t.langAuto],
    ["en", "EN"],
    ["bn", "বাংলা"],
  ];
  return (
    <div role="radiogroup" aria-label={t.language} title={t.language} className="flex h-9 items-center rounded-lg border bg-card p-0.5 text-xs font-medium">
      {opts.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "h-full rounded-md px-2.5 transition-colors",
            value === v ? "bg-brand text-white dark:text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
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

function Welcome({ t, firstName, onPick, disabled }: { t: CoachText; firstName: string; onPick: (q: string) => void; disabled: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="py-6 sm:py-10">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink shadow-soft">
          <Sparkles className="size-7" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{t.greeting(firstName)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.intro}</p>
      </div>
      <div className="mx-auto mt-8 grid max-w-3xl gap-2 sm:grid-cols-2">
        {t.suggestions.map((s) => (
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

function Avatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
      <Bot className="size-4.5" />
    </div>
  );
}

/** The answer as it streams in, with what the coach is looking at. */
function Live({ live, t, lang, currency }: { live: { text: string; tools: string[] }; t: CoachText; lang: CoachLang; currency: string }) {
  const status = live.text ? null : live.tools.length ? (t.tools[live.tools[live.tools.length - 1]] ?? t.thinking) : t.thinking;
  return (
    <div className="flex gap-3" role="status" aria-live="polite">
      <Avatar />
      <div className="min-w-0 flex-1">
        {live.tools.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {[...new Set(live.tools.map((n) => t.toolLabel[n] ?? n))].map((label) => (
              <span key={label} className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                <Check className="size-3 text-profit" /> {label}
              </span>
            ))}
          </div>
        )}
        {live.text ? (
          <CoachMarkdown text={live.text} currency={currency} lang={lang} />
        ) : (
          <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md border bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft">
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
              <motion.span key={status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                {status}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function Message({ m, t, lang, currency, onRetry }: { m: Msg; t: CoachText; lang: CoachLang; currency: string; onRetry: () => void }) {
  if (m.role === "user") {
    return (
      <motion.div
        data-msg={m.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("flex flex-col items-end gap-1.5", SCROLL_MT)}
      >
        {m.previews && m.previews.length > 0 ? (
          <div className="flex gap-1.5">
            {m.previews.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p} alt="" className="h-28 max-w-48 rounded-xl border object-cover" />
            ))}
          </div>
        ) : m.images ? (
          <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs text-muted-foreground">
            <ImagePlus className="size-3" /> {m.images}
          </span>
        ) : null}
        {m.content && (
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] whitespace-pre-wrap text-primary-foreground shadow-soft">
            {m.content}
          </div>
        )}
      </motion.div>
    );
  }
  if (m.error) {
    return (
      <div data-msg={m.id} className={cn("flex gap-3", SCROLL_MT)}>
        <Avatar />
        <div className="rounded-2xl rounded-tl-md border border-loss/40 bg-loss-soft/50 px-4 py-3 text-sm">
          <p className="text-loss">{m.content}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
            <RotateCcw /> {t.tryAgain}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <motion.div data-msg={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", SCROLL_MT)}>
      <Avatar />
      <div className="min-w-0 flex-1">
        <CoachMarkdown text={m.content} currency={currency} lang={lang} />
        <AnswerBar m={m} t={t} />
      </div>
    </motion.div>
  );
}

function AnswerBar({ m, t }: { m: Msg; t: CoachText }) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<number>(m.feedback ?? 0);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [saving, start] = useTransition();
  // Stopped answers aren't saved on our side yet, so they can't be rated or kept.
  const persisted = !m.stopped;
  const rate = (v: 1 | -1) => {
    const next = rating === v ? 0 : v;
    setRating(next);
    void rateCoachMessage(m.id, next as -1 | 0 | 1);
  };
  const icon = "inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-accent hover:text-foreground disabled:opacity-50";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {m.toolsUsed && m.toolsUsed.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-1">
          {t.lookedAt}
          {[...new Set(m.toolsUsed.map((x) => t.toolLabel[x] ?? x))].map((x) => (
            <span key={x} className="rounded-full border bg-card px-2 py-0.5">
              {x}
            </span>
          ))}
        </span>
      )}
      <span className="ml-auto inline-flex items-center gap-0.5">
        {persisted && (
          <>
            <button
              type="button"
              className={cn(icon, rating === 1 && "text-profit")}
              aria-pressed={rating === 1}
              aria-label={t.helpful}
              title={t.helpful}
              onClick={() => rate(1)}
            >
              <ThumbsUp className={cn("size-3.5", rating === 1 && "fill-current")} />
            </button>
            <button
              type="button"
              className={cn(icon, rating === -1 && "text-loss")}
              aria-pressed={rating === -1}
              aria-label={t.notHelpful}
              title={t.notHelpful}
              onClick={() => rate(-1)}
            >
              <ThumbsDown className={cn("size-3.5", rating === -1 && "fill-current")} />
            </button>
            {noteId ? (
              <Link href={`/notebook?id=${noteId}`} className={cn(icon, "text-profit")}>
                <Check className="size-3.5" /> {t.openNote}
              </Link>
            ) : (
              <button
                type="button"
                className={icon}
                disabled={saving}
                onClick={() =>
                  start(async () => {
                    const r = await saveCoachAnswerToNotebook(m.id);
                    if (r.ok) setNoteId(r.noteId);
                  })
                }
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <NotebookPen className="size-3.5" />} {t.save}
              </button>
            )}
          </>
        )}
        <button
          type="button"
          className={icon}
          onClick={() => {
            void navigator.clipboard?.writeText(m.content).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? t.copied : t.copy}
        </button>
      </span>
    </div>
  );
}

function ConversationList({
  t,
  convs,
  activeId,
  onNavigate,
  onDeleted,
  onRenamed,
}: {
  t: CoachText;
  convs: Conv[];
  activeId: string | null;
  onNavigate: () => void;
  onDeleted: (id: string) => void;
  onRenamed: (id: string, title: string) => void;
}) {
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [, start] = useTransition();
  if (!convs.length) return <p className="px-2 py-4 text-sm text-muted-foreground">{t.noChats}</p>;
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
              aria-label={t.rename}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
              onClick={async () => {
                const title = await prompt({ title: t.renameTitle, defaultValue: c.title, confirmLabel: "OK" });
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
              aria-label={t.delete}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-loss"
              onClick={async () => {
                const ok = await confirm({ title: t.deleteTitle, description: c.title, confirmLabel: t.delete, destructive: true });
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
