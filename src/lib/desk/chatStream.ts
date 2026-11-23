export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  symbol: string;
  tf: string;
  tab?: string;
}

/** Turns kept when sending history; the server accepts at most 20. */
export const MAX_SENT_TURNS = 20;

/** Splits an SSE buffer into complete events plus the unfinished remainder. Pure. */
export function parseSse(buffer: string): { events: ChatEvent[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? "";
  const events: ChatEvent[] = [];
  for (const block of blocks) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as ChatEvent);
    } catch {
      // A malformed frame is skipped rather than killing the whole answer.
    }
  }
  return { events, rest };
}

/** The last MAX_SENT_TURNS turns, never starting on an assistant message. */
export function trimHistory(turns: readonly ChatTurn[]): ChatTurn[] {
  const recent = turns.slice(-MAX_SENT_TURNS);
  const firstUser = recent.findIndex((t) => t.role === "user");
  return firstUser <= 0 ? [...recent] : recent.slice(firstUser);
}

/** POSTs the conversation and calls onEvent for each streamed event. Throws on HTTP errors. */
export async function streamChat(
  apiBase: string,
  headers: Record<string, string>,
  turns: readonly ChatTurn[],
  context: ChatContext,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${apiBase}/api/chat`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: trimHistory(turns), context }),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSse(buffer);
    buffer = parsed.rest;
    parsed.events.forEach(onEvent);
  }
}
