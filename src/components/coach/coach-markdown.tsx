"use client";

import Link from "next/link";
import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { closeOpenFence, parseBlock } from "@/lib/coach-blocks";
import { cn } from "@/lib/utils";
import { CoachBlockView } from "./blocks";

/** Markdown answer with the coach's rich blocks (chart, table, cards, callout). */
export const CoachMarkdown = memo(function CoachMarkdown({ text, currency }: { text: string; currency: string }) {
  const components: Components = {
    // Fenced blocks arrive as <pre><code class="language-x">; ours render as widgets.
    pre({ children, node, ...rest }) {
      const code = node?.children?.[0];
      if (code && code.type === "element" && code.tagName === "code") {
        const cls = (code.properties?.className as string[] | undefined)?.find((c) => c.startsWith("language-"));
        const raw = code.children.map((c) => ("value" in c ? c.value : "")).join("");
        if (cls) {
          const block = parseBlock(cls.slice(9), raw);
          if (block) return <CoachBlockView block={block} currency={currency} />;
          // A block that is still unfinished or broken: don't show raw JSON.
          if (["chart", "table", "cards", "callout"].includes(cls.slice(9))) return null;
        }
      }
      return (
        <pre {...rest} className="my-3 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
          {children}
        </pre>
      );
    },
    code({ className, children, ...rest }) {
      return (
        <code {...rest} className={cn("rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]", className)}>
          {children}
        </code>
      );
    },
    a({ href = "", children }) {
      if (href.startsWith("/"))
        return (
          <Link href={href} className="font-medium text-brand-ink underline underline-offset-2 hover:no-underline">
            {children}
          </Link>
        );
      return (
        <a href={href} target="_blank" rel="noreferrer noopener" className="font-medium text-brand-ink underline underline-offset-2">
          {children}
        </a>
      );
    },
    table({ children }) {
      return (
        <div className="my-3 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">{children}</table>
        </div>
      );
    },
    th: ({ children }) => <th className="bg-muted/50 px-3 py-2 text-left text-xs font-medium text-muted-foreground">{children}</th>,
    td: ({ children }) => <td className="border-t px-3 py-2 align-top">{children}</td>,
    h1: ({ children }) => <h3 className="mt-4 mb-2 text-lg font-semibold">{children}</h3>,
    h2: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>,
    h3: ({ children }) => <h4 className="mt-3 mb-1.5 font-semibold">{children}</h4>,
    p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="my-2 ml-5 list-disc space-y-1 marker:text-muted-foreground">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 ml-5 list-decimal space-y-1 marker:text-muted-foreground">{children}</ol>,
    blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-brand pl-3 text-muted-foreground">{children}</blockquote>,
    hr: () => <hr className="my-4" />,
  };
  return (
    <div className="text-[15px] break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {closeOpenFence(text)}
      </ReactMarkdown>
    </div>
  );
});

