"use client";

import { Download, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ShareDialog({ query, label, children }: { query: string; label: string; children: React.ReactNode }) {
  const [hide, setHide] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);
  const src = `/api/share/card?${query}${hide ? "&hide=1" : ""}`;
  const filename = `journal-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;

  const share = async () => {
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `Trading results · ${label}` });
      else toast.info("Sharing isn't supported here — use Download instead.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Couldn't share the image.");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share card</DialogTitle>
          <DialogDescription>An image of this period&apos;s results for social media or your trading group.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-[1200/630] overflow-hidden rounded-xl border bg-muted">
          {loaded !== src && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- generated per request, not an optimisable static asset */}
          <img key={src} src={src} alt={`Results card for ${label}`} className="size-full object-cover" onLoad={() => setLoaded(src)} />
        </div>
        <label className="flex w-fit items-center gap-2 text-sm">
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="size-4 accent-[var(--brand)]" />
          Hide money amounts (show win rate and R instead)
        </label>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={src} download={filename}>
              <Download /> Download PNG
            </a>
          </Button>
          <Button variant="outline" onClick={share}>
            <Share2 /> Share…
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
