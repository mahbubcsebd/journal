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

type Mark = { type: string; attrs?: Record<string, unknown> };
type Inline = { type: "text"; text: string; marks?: Mark[] };

/** **bold**, *italic*, `code` and [links](/x) → Tiptap text nodes. */
function inline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1]) out.push({ type: "text", text: m[1], marks: [{ type: "bold" }] });
    else if (m[2]) out.push({ type: "text", text: m[2], marks: [{ type: "italic" }] });
    else if (m[3]) out.push({ type: "text", text: m[3], marks: [{ type: "code" }] });
    else out.push({ type: "text", text: m[4], marks: [{ type: "link", attrs: { href: m[5] } }] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out.filter((n) => n.text);
}

const para = (text: string): DocNode => {
  const content = inline(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
};
const list = (items: string[], ordered = false): DocNode => ({
  type: ordered ? "orderedList" : "bulletList",
  content: items.map((i) => ({ type: "listItem", content: [para(i)] })),
});

/** The coach's rich blocks, flattened to readable text for a note. */
function blockToNodes(lang: string, raw: string): DocNode[] {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    return [];
  }
  const title = typeof j.title === "string" ? [para(`**${j.title}**`)] : [];
  switch (lang) {
    case "cards":
      return [list(((j.items as { label: string; value: string; sub?: string }[]) ?? []).map((c) => `**${c.label}:** ${c.value}${c.sub ? ` (${c.sub})` : ""}`))];
    case "chart":
      return [...title, list(((j.data as { label: string; value: number }[]) ?? []).map((d) => `${d.label}: ${d.value}`))];
    case "table": {
      const cols = (j.columns as string[]) ?? [];
      const rows = (j.rows as unknown[][]) ?? [];
      return [...title, list(rows.map((r) => r.map((c, i) => (cols[i] ? `${cols[i]}: ${c ?? ""}` : String(c ?? ""))).join(" · ")))];
    }
    case "callout":
      return [{ type: "blockquote", content: [...(typeof j.title === "string" ? [para(`**${j.title}**`)] : []), para(String(j.text ?? ""))] }];
    default:
      return [];
  }
}

/** Markdown (as the AI coach writes it) → a Tiptap doc for the notebook. */
export function markdownToDoc(md: string): DocNode {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: DocNode[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];
  const flush = () => {
    if (bullets.length) out.push(list(bullets));
    if (numbers.length) out.push(list(numbers, true));
    bullets = [];
    numbers = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^```(\w*)/.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) body.push(lines[i]);
      out.push(...blockToNodes(fence[1].toLowerCase(), body.join("\n")));
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    const b = /^\s*[-*+]\s+(.*)$/.exec(line);
    const n = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (b) {
      if (numbers.length) flush();
      bullets.push(b[1]);
    } else if (n) {
      if (bullets.length) flush();
      numbers.push(n[1]);
    } else {
      flush();
      if (h) out.push({ type: "heading", attrs: { level: h[1].length <= 2 ? 2 : 3 }, content: inline(h[2]) });
      else if (line.startsWith("> ")) out.push({ type: "blockquote", content: [para(line.slice(2))] });
      else if (line.trim() && !/^\|?\s*-{3,}/.test(line)) out.push(para(line.replace(/^\||\|$/g, "").replace(/\s*\|\s*/g, " · ").trim()));
    }
  }
  flush();
  return { type: "doc", content: out.length ? out : [{ type: "paragraph" }] };
}
