import { describe, expect, it } from "vitest";
import { docToText, markdownToDoc } from "./doc";

describe("markdownToDoc", () => {
  it("converts headings, lists, marks, links and blocks", () => {
    const doc = markdownToDoc(
      [
        "## Review",
        "You **lost** money on [XAUUSD](/trades/1).",
        "- one",
        "- two",
        "1. first",
        "```cards",
        '{"items":[{"label":"Net","value":"-$40","sub":"30d"}]}',
        "```",
        "```callout",
        '{"tone":"warning","title":"Rule","text":"No news trades"}',
        "```",
        "```action",
        '{"items":[]}',
        "```",
      ].join("\n"),
    );
    const types = doc.content!.map((n) => n.type);
    expect(types).toEqual(["heading", "paragraph", "bulletList", "orderedList", "bulletList", "blockquote"]);
    const p = doc.content![1].content!;
    expect(p[1]).toEqual({ type: "text", text: "lost", marks: [{ type: "bold" }] });
    expect(p[3]).toEqual({ type: "text", text: "XAUUSD", marks: [{ type: "link", attrs: { href: "/trades/1" } }] });
    const text = docToText(doc);
    expect(text).toContain("Net: -$40 (30d)");
    expect(text).toContain("No news trades");
  });
});
