import type { ReactNode } from "react";

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="rounded bg-water px-1 py-0.5 text-[12.5px] tabular-nums text-gold">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const HEADING = /^#{1,4}\s+(.*)$/;

/** Tiny markdown subset (bold, code, bullets, headings). Renders text nodes only, so model output cannot inject HTML. */
export default function ChatMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul${blocks.length}`} className="my-1.5 list-disc space-y-1 pl-5 marker:text-gold">
        {bullets.map((b, i) => (
          <li key={i}>{inline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const line of text.split("\n")) {
    const bullet = BULLET.exec(line);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push(
        <p key={blocks.length} className="mt-2 font-semibold text-gold">
          {inline(heading[1])}
        </p>,
      );
    } else if (line.trim()) {
      blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <div className="space-y-1.5 leading-relaxed">{blocks}</div>;
}
