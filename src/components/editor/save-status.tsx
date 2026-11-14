"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { SaveStatus } from "@/hooks/use-autosave";

export function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {status !== "idle" && (
        <motion.span
          key={status}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          role="status"
        >
          {status === "saving" && <Loader2 className="size-3 animate-spin" />}
          {status === "saved" && <Check className="size-3 text-profit" />}
          {status === "error" && <AlertCircle className="size-3 text-loss" />}
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Couldn't save — retrying on next change"}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
