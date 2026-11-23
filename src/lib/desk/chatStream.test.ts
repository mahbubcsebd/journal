import assert from "node:assert/strict";
import { test } from "vitest";
import { parseSse, trimHistory, type ChatTurn } from "./chatStream";

test("parseSse returns complete events and keeps the partial tail", () => {
  const { events, rest } = parseSse('data: {"type":"text","text":"hi"}\n\ndata: {"type":"done"}\n\ndata: {"type":"te');
  assert.deepEqual(events, [{ type: "text", text: "hi" }, { type: "done" }]);
  assert.equal(rest, 'data: {"type":"te');
});

test("parseSse skips malformed frames", () => {
  const { events } = parseSse('data: {oops\n\ndata: {"type":"done"}\n\n');
  assert.deepEqual(events, [{ type: "done" }]);
});

test("trimHistory caps at 20 turns, starts on a user turn and does not mutate input", () => {
  const turns: ChatTurn[] = Array.from({ length: 25 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: String(i),
  }));
  const snapshot = [...turns];
  const out = trimHistory(turns);
  assert.deepEqual(turns, snapshot);
  assert.ok(out.length <= 20);
  assert.equal(out[0].role, "user");
  assert.equal(out[out.length - 1].content, "24");
});
