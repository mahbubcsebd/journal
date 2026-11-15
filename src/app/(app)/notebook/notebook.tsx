"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, BookOpen, FileText, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { RichEditor } from "@/components/editor/rich-editor";
import { SaveIndicator } from "@/components/editor/save-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAutosave } from "@/hooks/use-autosave";
import type { DocNode } from "@/lib/doc";
import { NOTE_TEMPLATES } from "@/lib/note-templates";
import { cn, formatDateTime } from "@/lib/utils";
import { createNote, deleteNote, updateNote } from "@/server/actions/notes";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Note = {
  id: string;
  title: string;
  folder: string;
  pinned: boolean;
  content: unknown;
  preview: string;
  updatedAt: string;
};

export function Notebook({ notes, selectedId, timezone }: { notes: Note[]; selectedId: string | null; timezone: string }) {
  const router = useRouter();
  const [folder, setFolder] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [creating, start] = useTransition();
  const folders = useMemo(() => [...new Set(notes.map((n) => n.folder))].sort(), [notes]);
  const filtered = notes.filter(
    (n) =>
      (!folder || n.folder === folder) &&
      (!q || `${n.title} ${n.preview}`.toLowerCase().includes(q.toLowerCase())),
  );
  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const create = (template?: string) =>
    start(async () => {
      const id = await createNote({ folder: folder ?? undefined, template });
      router.push(`/notebook?id=${id}`, { scroll: false });
    });

  return (
    <div className="grid min-h-[640px] gap-4 lg:grid-cols-[340px_1fr]">
      <Card className={cn("flex flex-col overflow-hidden", selected && "hidden lg:flex")}>
        <div className="grid gap-3 border-b p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" className="h-9 pl-8" aria-label="Search notes" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-9" disabled={creating}>
                  <Plus /> New
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => create()}>
                  <FileText /> Blank note
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>From a template</DropdownMenuLabel>
                {NOTE_TEMPLATES.map((t) => (
                  <DropdownMenuItem key={t.key} onSelect={() => create(t.key)}>
                    <BookOpen /> {t.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {folders.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[null, ...folders].map((f) => (
                <button
                  key={f ?? "all"}
                  type="button"
                  onClick={() => setFolder(f)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition",
                    folder === f ? "border-transparent bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f ?? "All"}
                </button>
              ))}
            </div>
          )}
        </div>
        <ul className="flex-1 overflow-y-auto p-1.5">
          <AnimatePresence initial={false}>
            {filtered.map((n) => (
              <motion.li key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
                <button
                  type="button"
                  onClick={() => router.push(`/notebook?id=${n.id}`, { scroll: false })}
                  className={cn(
                    "grid w-full gap-0.5 rounded-lg px-3 py-2.5 text-left transition",
                    n.id === selectedId ? "bg-secondary" : "hover:bg-accent",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {n.pinned && <Pin className="size-3 shrink-0 text-brand-ink" />}
                    <span className="truncate">{n.title}</span>
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{n.preview || "No content"}</span>
                  <span className="text-[11px] text-muted-foreground/80">
                    {n.folder} · {formatDateTime(n.updatedAt, timezone)}
                  </span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-sm text-muted-foreground">
              {notes.length ? "No notes match." : "No notes yet — create one or start from a template."}
            </li>
          )}
        </ul>
      </Card>

      {selected ? (
        <NoteEditor key={selected.id} note={selected} folders={folders} onBack={() => router.push("/notebook", { scroll: false })} />
      ) : (
        <Card className="hidden flex-col items-center justify-center gap-3 p-10 text-center lg:flex">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <BookOpen className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">Select a note, or create a new one.</p>
        </Card>
      )}
    </div>
  );
}

function NoteEditor({ note, folders, onBack }: { note: Note; folders: string[]; onBack: () => void }) {
  const confirm = useConfirm();
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [folder, setFolder] = useState(note.folder);
  const [content, setContent] = useState(note.content as DocNode | null);
  const [pinned, setPinned] = useState(note.pinned);
  const [, start] = useTransition();
  const status = useAutosave({ title, folder, content }, (v) => updateNote(note.id, v));

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className="flex h-full flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Back to notes" onClick={onBack}>
            <ArrowLeft />
          </Button>
          <Input
            list="note-folders"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            onBlur={(e) => !e.target.value.trim() && setFolder("General")}
            aria-label="Folder"
            className="h-8 w-36 text-xs"
          />
          <datalist id="note-folders">
            {[...new Set([...folders, "General", "Ideas", "Research", "Reviews", "Lessons"])].map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <div className="flex-1" />
          <SaveIndicator status={status} />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={pinned ? "Unpin" : "Pin"}
            title={pinned ? "Unpin" : "Pin to top"}
            onClick={() => {
              setPinned(!pinned);
              start(() => updateNote(note.id, { pinned: !pinned }));
            }}
          >
            {pinned ? <PinOff /> : <Pin />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete note"
            className="hover:bg-loss-soft hover:text-loss"
            onClick={async () => {
              if (!(await confirm({ title: `Delete "${title || "Untitled"}"?`, destructive: true }))) return;
              start(async () => {
                await deleteNote(note.id);
                router.push("/notebook", { scroll: false });
              });
            }}
          >
            <Trash2 />
          </Button>
        </div>
        <div className="grid flex-1 content-start gap-3 p-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            aria-label="Title"
            className="bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
          />
          <RichEditor value={content} onChange={setContent} placeholder="Start writing…" minHeight={420} autofocus={note.title === "Untitled"} ariaLabel="Note" />
        </div>
      </Card>
    </motion.div>
  );
}
