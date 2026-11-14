import type { DocNode } from "./doc";

const h = (text: string): DocNode => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const p = (text?: string): DocNode => (text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" });
const tasks = (items: string[]): DocNode => ({
  type: "taskList",
  content: items.map((t) => ({ type: "taskItem", attrs: { checked: false }, content: [p(t)] })),
});

export const NOTE_TEMPLATES: { key: string; title: string; folder: string; doc: DocNode }[] = [
  {
    key: "idea",
    title: "Trade idea",
    folder: "Ideas",
    doc: { type: "doc", content: [h("Instrument & timeframe"), p(), h("Thesis"), p(), h("Entry, stop, target"), p(), h("What invalidates it"), p()] },
  },
  {
    key: "weekly",
    title: "Weekly review",
    folder: "Reviews",
    doc: {
      type: "doc",
      content: [
        h("Numbers"),
        p("Net P&L, win rate, best and worst day."),
        h("What worked"),
        p(),
        h("What didn't"),
        p(),
        h("Rules I broke"),
        p(),
        h("Focus for next week"),
        tasks(["", ""]),
      ],
    },
  },
  {
    key: "research",
    title: "Strategy research",
    folder: "Research",
    doc: { type: "doc", content: [h("Hypothesis"), p(), h("Rules"), tasks([""]), h("Backtest results"), p(), h("Conclusion"), p()] },
  },
  {
    key: "lesson",
    title: "Lesson learned",
    folder: "Lessons",
    doc: { type: "doc", content: [h("What happened"), p(), h("Why it happened"), p(), h("What I'll do next time"), p()] },
  },
];
