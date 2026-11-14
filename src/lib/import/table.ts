import { parse } from "node-html-parser";
import { readSheet } from "read-excel-file/universal";

export type Cell = string;
export type Grid = Cell[][];

/** MT5 saves HTML reports as UTF-16LE with a BOM; handle that and UTF-8. */
export function decodeText(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b.subarray(2));
  // UTF-16 without BOM: every other byte is zero for ASCII text.
  if (b.length > 4 && b[1] === 0 && b[3] === 0) return new TextDecoder("utf-16le").decode(b);
  const text = new TextDecoder("utf-8").decode(b);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Flatten every <tr> in the document into a grid, expanding colspans. */
export function htmlToGrid(html: string): Grid {
  const root = parse(html, { lowerCaseTagName: true });
  return root.querySelectorAll("tr").map((tr) => {
    const row: Cell[] = [];
    for (const td of tr.querySelectorAll("td, th")) {
      // Newer MT5 builds pad tables with invisible spacer cells.
      if (/\bhidden\b/.test(td.getAttribute("class") ?? "")) continue;
      const span = Math.max(1, Number(td.getAttribute("colspan") ?? 1) || 1);
      row.push(clean(td.textContent));
      for (let i = 1; i < span; i++) row.push("");
    }
    return row;
  });
}

export async function xlsxToGrid(buf: ArrayBuffer): Promise<Grid> {
  const rows = await readSheet(buf);
  return rows.map((r) =>
    r.map((c) => {
      if (c == null) return "";
      if ((c as unknown) instanceof Date) return formatDate(c as unknown as Date);
      return clean(String(c));
    }),
  );
}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF), auto-detects ; or , or tab. */
export function csvToGrid(text: string): Grid {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].sort((a, b) => count(firstLine, b) - count(firstLine, a))[0];
  const rows: Grid = [];
  let row: Cell[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(clean(cell));
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(clean(cell));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(clean(cell));
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

function count(s: string, ch: string) {
  return s.split(ch).length - 1;
}

function clean(s: string) {
  return s
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
