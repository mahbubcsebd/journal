"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/desk/settings";
import { useChat } from "@/lib/desk/useChat";
import ChatMarkdown from "./ChatMarkdown";

interface Props {
  symbol: string;
  tf: string;
  tab: string;
}

const SUGGESTIONS = ["chat.suggest1", "chat.suggest2", "chat.suggest3"];

export default function ChatPanel({ symbol, tf, tab }: Props) {
  const t = useT();
  const chat = useChat();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat.messages, chat.tool, open]);

  const submit = (text: string) => {
    if (chat.busy || !text.trim()) return;
    chat.send(text, { symbol, tf, tab }, t("chat.error"));
    setDraft("");
  };

  const disabled = chat.enabled === false;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("chat.button")}
        className="fixed bottom-[68px] right-4 z-40 flex items-center gap-2 rounded-full border border-gold/60 bg-deck px-4 py-2.5 text-[14px] font-semibold text-gold shadow-lg shadow-black/40 transition hover:border-gold hover:bg-hull active:scale-95 lg:bottom-5 lg:right-5"
      >
        <span aria-hidden className="text-[16px] leading-none">
          ✦
        </span>
        {t("chat.button")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-water/60" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={t("chat.title")}
            onClick={(e) => e.stopPropagation()}
            className="flex h-svh w-full flex-col border-l border-line bg-hull sm:max-w-[440px]"
          >
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-semibold">{t("chat.title")}</h2>
                <p className="text-[12px] text-mute">{t("chat.context", { symbol, tf })}</p>
              </div>
              {chat.messages.length > 0 && (
                <button type="button" onClick={chat.clear} className="rounded-md px-2 py-1 text-[13px] text-mute hover:text-ink">
                  {t("chat.clear")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("chat.close")}
                className="rounded-md px-2 py-1 text-mute hover:text-ink"
              >
                ✕
              </button>
            </header>

            <div ref={listRef} className="brief-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[14px]">
              {disabled && <p className="rounded-md border border-line bg-deck px-3 py-2.5 text-[13px] text-mute">{t("chat.off")}</p>}

              {!disabled && chat.messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-mute">{t("chat.intro")}</p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => submit(t(key))}
                        className="rounded-lg border border-line bg-deck px-3 py-2 text-left text-[13.5px] hover:border-gold/60"
                      >
                        {t(key)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chat.messages.map((m) =>
                m.role === "user" ? (
                  <p key={m.id} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-deck px-3.5 py-2">
                    {m.content}
                  </p>
                ) : (
                  <div
                    key={m.id}
                    className={`max-w-[95%] border-l-2 pl-3 ${m.isError ? "border-coral text-coral" : "border-gold/70 text-ink"}`}
                  >
                    {m.isError ? <p>{m.content}</p> : <ChatMarkdown text={m.content} />}
                  </div>
                ),
              )}

              {chat.busy && (
                <p className="pulse-dot text-[13px] text-gold" aria-live="polite">
                  {chat.tool ? t("chat.tool", { name: t(`chat.tool.${chat.tool}`) }) : t("chat.thinking")}
                </p>
              )}
            </div>

            <footer className="border-t border-line p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(draft);
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  ref={inputRef}
                  value={draft}
                  rows={2}
                  disabled={disabled}
                  maxLength={4000}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      submit(draft);
                    }
                  }}
                  placeholder={t("chat.placeholder")}
                  aria-label={t("chat.placeholder")}
                  className="min-h-[44px] flex-1 resize-none rounded-md border border-line bg-water px-3 py-2 text-[14px] placeholder:text-mute focus:border-gold focus:outline-none disabled:opacity-50"
                />
                {chat.busy ? (
                  <button type="button" onClick={chat.stop} className="rounded-md border border-coral px-3 py-2 text-[13px] font-semibold text-coral">
                    {t("chat.stop")}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={disabled || !draft.trim()}
                    className="rounded-md bg-gold px-4 py-2 text-[14px] font-semibold text-water hover:brightness-110 disabled:opacity-40"
                  >
                    {t("chat.send")}
                  </button>
                )}
              </form>
              <p className="mt-2 text-[11px] text-mute">{t("chat.disclaimer")}</p>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
