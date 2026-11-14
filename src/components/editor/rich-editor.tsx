"use client";

import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import type { DocNode } from "@/lib/doc";
import { cn } from "@/lib/utils";

type Props = {
  value: DocNode | null;
  onChange: (doc: DocNode) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  toolbar?: boolean;
  autofocus?: boolean;
  ariaLabel?: string;
};

export function RichEditor({ value, onChange, placeholder, className, minHeight = 120, toolbar = true, autofocus, ariaLabel }: Props) {
  const editor = useEditor({
    // Render on the client only so the server HTML never mismatches.
    immediatelyRender: false,
    autofocus: autofocus ? "end" : false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? "Write something…" }),
    ],
    content: value ?? undefined,
    editorProps: {
      attributes: {
        class: "rich-editor-content focus:outline-none",
        style: `min-height:${minHeight}px`,
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as DocNode),
  });

  return (
    <div
      className={cn(
        "rich-editor rounded-xl border border-input bg-card transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15",
        className,
      )}
    >
      {toolbar && <Toolbar editor={editor} />}
      <div className="px-3.5 py-3">
        {editor ? <EditorContent editor={editor} /> : <div style={{ minHeight }} className="text-sm text-muted-foreground/70">{placeholder}</div>}
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            task: e.isActive("taskList"),
            quote: e.isActive("blockquote"),
            code: e.isActive("code"),
            link: e.isActive("link"),
          }
        : null,
  });
  if (!editor) return <div className="h-[37px] border-b" />;
  // The selector only re-runs on editor transactions, so it can still be null
  // right after the editor is created: render with nothing active until then.
  const active = (state ?? {}) as Record<string, boolean>;
  const c = () => editor.chain().focus();
  const buttons = [
    { key: "bold", icon: Bold, label: "Bold", run: () => c().toggleBold().run() },
    { key: "italic", icon: Italic, label: "Italic", run: () => c().toggleItalic().run() },
    { key: "underline", icon: Underline, label: "Underline", run: () => c().toggleUnderline().run() },
    { key: "strike", icon: Strikethrough, label: "Strikethrough", run: () => c().toggleStrike().run() },
    "sep",
    { key: "h2", icon: Heading2, label: "Heading", run: () => c().toggleHeading({ level: 2 }).run() },
    { key: "h3", icon: Heading3, label: "Subheading", run: () => c().toggleHeading({ level: 3 }).run() },
    "sep",
    { key: "bullet", icon: List, label: "Bullet list", run: () => c().toggleBulletList().run() },
    { key: "ordered", icon: ListOrdered, label: "Numbered list", run: () => c().toggleOrderedList().run() },
    { key: "task", icon: ListChecks, label: "Checklist", run: () => c().toggleTaskList().run() },
    { key: "quote", icon: Quote, label: "Quote", run: () => c().toggleBlockquote().run() },
    { key: "code", icon: Code, label: "Code", run: () => c().toggleCode().run() },
    {
      key: "link",
      icon: Link2,
      label: "Link",
      run: () => {
        if (editor.isActive("link")) return c().unsetLink().run();
        const url = window.prompt("Link URL");
        if (url) c().setLink({ href: /^https?:\/\//.test(url) ? url : `https://${url}` }).run();
      },
    },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1" role="toolbar" aria-label="Formatting">
      {buttons.map((b, i) =>
        b === "sep" ? (
          <span key={i} className="mx-1 h-4 w-px bg-border" />
        ) : (
          <button
            key={b.key}
            type="button"
            title={b.label}
            aria-label={b.label}
            aria-pressed={Boolean(active[b.key])}
            onMouseDown={(e) => e.preventDefault()}
            onClick={b.run}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground",
              active[b.key] && "bg-secondary text-foreground",
            )}
          >
            <b.icon className="size-3.5" />
          </button>
        ),
      )}
    </div>
  );
}
