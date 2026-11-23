"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiBase, apiHeaders } from "./format";
import { streamChat, type ChatContext, type ChatTurn } from "./chatStream";

export interface ChatMessage extends ChatTurn {
  id: number;
  isError?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  busy: boolean;
  /** Name of the tool the assistant is calling right now, if any. */
  tool: string | null;
  /** null while checking; false when the server has no GEMINI_API_KEY. */
  enabled: boolean | null;
  send(text: string, context: ChatContext, fallbackError: string): void;
  stop(): void;
  clear(): void;
}

export function useChat(): ChatState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    fetch(`${apiBase()}/api/chat/status`, { headers: apiHeaders() })
      .then((r) => r.json())
      .then((j: { enabled?: boolean }) => setEnabled(Boolean(j.enabled)))
      .catch(() => setEnabled(false));
    return () => abortRef.current?.abort();
  }, []);

  const send = useCallback((text: string, context: ChatContext, fallbackError: string) => {
    const content = text.trim();
    if (!content || abortRef.current) return;
    const userMsg: ChatMessage = { id: nextId.current++, role: "user", content };
    const replyId = nextId.current++;
    const history = [...messagesRef.current.filter((m) => !m.isError), userMsg].map(({ role, content }) => ({ role, content }));
    setMessages([...messagesRef.current, userMsg, { id: replyId, role: "assistant", content: "" }]);
    setBusy(true);
    setTool(null);

    const patchReply = (fn: (m: ChatMessage) => ChatMessage) =>
      setMessages((list) => list.map((m) => (m.id === replyId ? fn(m) : m)));
    const abort = new AbortController();
    abortRef.current = abort;

    streamChat(
      apiBase(),
      apiHeaders(),
      history,
      context,
      (event) => {
        if (event.type === "text") {
          setTool(null);
          patchReply((m) => ({ ...m, content: m.content + event.text }));
        } else if (event.type === "tool") {
          setTool(event.name);
        } else if (event.type === "error") {
          patchReply((m) => ({ ...m, content: event.message, isError: true }));
        }
      },
      abort.signal,
    )
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        patchReply((m) => ({ ...m, content: err instanceof Error ? err.message : fallbackError, isError: true }));
      })
      .finally(() => {
        abortRef.current = null;
        setBusy(false);
        setTool(null);
        // Drop an empty reply (e.g. stopped before any text arrived).
        setMessages((list) => list.filter((m) => m.id !== replyId || m.content !== ""));
      });
  }, []);

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  return { messages, busy, tool, enabled, send, stop, clear };
}
