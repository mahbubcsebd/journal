"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { deleteTradeImage, updateImageCaption, uploadTradeImages } from "@/server/actions/trade-images";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Img = { id: string; caption: string | null };

export function TradeImages({ tradeId, initial }: { tradeId: string; initial: Img[] }) {
  const [images, setImages] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, startUpload] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const upload = (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    const fd = new FormData();
    imgs.forEach((f, i) => fd.append("files", f, f.name || `screenshot-${i + 1}.png`));
    startUpload(async () => {
      try {
        const res = await uploadTradeImages(tradeId, fd);
        if (res.added?.length) {
          setImages((all) => [...all, ...res.added!]);
          toast.success(res.added.length === 1 ? "Screenshot added" : `${res.added.length} screenshots added`);
        }
        if (res.error) toast.error(res.error);
      } catch {
        toast.error("Upload failed. Please try again.");
      }
    });
  };

  // Paste a screenshot from the clipboard anywhere on the trade page (not while typing).
  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, [contenteditable=true]")) return;
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length) {
      e.preventDefault();
      upload(files);
    }
  });
  useEffect(() => {
    const h = (e: ClipboardEvent) => onPaste(e);
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, []);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Screenshots</p>
          <p className="text-[13px] text-muted-foreground">Drop images, or paste with Ctrl/⌘ + V</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} Add
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          aria-label="Add screenshots"
          className="sr-only"
          onChange={(e) => {
            upload([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload([...e.dataTransfer.files]);
        }}
        className={cn("mt-4 rounded-xl transition", dragging && "ring-2 ring-brand ring-offset-2 ring-offset-card")}
      >
        {images.length === 0 ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed py-10 text-sm text-muted-foreground transition hover:border-foreground/25"
          >
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            Add your chart before and after the trade
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <AnimatePresence initial={false}>
              {images.map((img, i) => (
                <motion.button
                  key={img.id}
                  type="button"
                  layout
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  onClick={() => setOpen(i)}
                  className="group relative aspect-video overflow-hidden rounded-lg border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated image */}
                  <img src={`/api/trade-images/${img.id}`} alt={img.caption ?? `Screenshot ${i + 1}`} loading="lazy" className="size-full object-cover transition group-hover:scale-[1.03]" />
                  {img.caption && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-left text-[11px] text-white">
                      {img.caption}
                    </span>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <Dialog open={open != null && Boolean(images[open])} onOpenChange={(o) => !o && setOpen(null)}>
        {open != null && images[open] && (
          <Lightbox
            tradeId={tradeId}
            images={images}
            index={open}
            onIndex={setOpen}
            onClose={() => setOpen(null)}
            onCaption={(id, caption) => setImages((all) => all.map((x) => (x.id === id ? { ...x, caption } : x)))}
            onDeleted={(id) => {
              setImages((all) => all.filter((x) => x.id !== id));
              setOpen(null);
            }}
          />
        )}
      </Dialog>
    </Card>
  );
}

function Lightbox({
  tradeId,
  images,
  index,
  onIndex,
  onClose,
  onCaption,
  onDeleted,
}: {
  tradeId: string;
  images: Img[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onCaption: (id: string, caption: string | null) => void;
  onDeleted: (id: string) => void;
}) {
  const confirm = useConfirm();
  const img = images[index];
  const [, start] = useTransition();
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    if (e.key === "ArrowRight" && index < images.length - 1) onIndex(index + 1);
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <DialogContent
      showCloseButton={false}
      aria-describedby={undefined}
      className="inset-0 top-0 left-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-black/85 p-0 text-white shadow-none backdrop-blur-sm data-[state=open]:animate-[fade-in_150ms_ease-out] data-[state=closed]:animate-[fade-out_120ms_ease-in]"
    >
      <DialogTitle className="sr-only">{img.caption ?? "Screenshot"}</DialogTitle>
      <div className="flex items-center gap-2 p-3 text-white">
        <span className="text-sm tabular opacity-70">
          {index + 1} / {images.length}
        </span>
        <input
          key={img.id}
          defaultValue={img.caption ?? ""}
          placeholder="Add a caption"
          aria-label="Caption"
          onBlur={(e) => {
            const c = e.target.value.trim() || null;
            if (c === img.caption) return;
            onCaption(img.id, c);
            start(() => updateImageCaption(tradeId, img.id, c ?? ""));
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="mx-auto w-full max-w-md rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/50 focus:bg-white/15"
        />
        <button
          type="button"
          aria-label="Delete screenshot"
          className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          onClick={async () => {
            if (!(await confirm({ title: "Delete this screenshot?", destructive: true }))) return;
            start(async () => {
              await deleteTradeImage(tradeId, img.id);
              onDeleted(img.id);
            });
          }}
        >
          <Trash2 className="size-5" />
        </button>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4" onClick={onClose}>
        <AnimatePresence mode="wait">
          <motion.img
            key={img.id}
            src={`/api/trade-images/${img.id}`}
            alt={img.caption ?? "Screenshot"}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        </AnimatePresence>
        {index > 0 && (
          <button
            type="button"
            aria-label="Previous"
            onClick={(e) => {
              e.stopPropagation();
              onIndex(index - 1);
            }}
            className="absolute left-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        {index < images.length - 1 && (
          <button
            type="button"
            aria-label="Next"
            onClick={(e) => {
              e.stopPropagation();
              onIndex(index + 1);
            }}
            className="absolute right-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>
    </DialogContent>
  );
}
