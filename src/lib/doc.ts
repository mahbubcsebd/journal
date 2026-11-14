/** Minimal Tiptap / ProseMirror JSON helpers usable on the server. */
export type DocNode = { type?: string; text?: string; content?: DocNode[]; attrs?: Record<string, unknown> };

export const EMPTY_DOC: DocNode = { type: "doc", content: [{ type: "paragraph" }] };

export function docToText(doc: unknown, max = Infinity): string {
  const out: string[] = [];
  let len = 0;
  const walk = (n: DocNode | undefined) => {
    if (!n || len > max) return;
    if (n.text) {
      out.push(n.text);
      len += n.text.length;
    }
    n.content?.forEach(walk);
    if (n.type && ["paragraph", "heading", "listItem", "taskItem", "blockquote", "codeBlock"].includes(n.type)) out.push(" ");
  };
  walk(doc as DocNode);
  const text = out.join("").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

export function isEmptyDoc(doc: unknown) {
  return docToText(doc, 1).length === 0;
}

/** Plain text → a doc of paragraphs (used to migrate older plain-text notes). */
export function textToDoc(text: string): DocNode {
  const paras = text.split(/\n{2,}|\n/).map((p) => (p ? { type: "paragraph", content: [{ type: "text", text: p }] } : { type: "paragraph" }));
  return { type: "doc", content: paras.length ? paras : [{ type: "paragraph" }] };
}
