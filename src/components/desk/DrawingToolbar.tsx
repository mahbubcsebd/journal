"use client";

import type { DrawingTool } from "@/lib/desk/drawings";
import { useT } from "@/lib/desk/settings";
import { buttonClass } from "./ui";

const TOOLS: { id: DrawingTool; labelKey: string }[] = [
  { id: "select", labelKey: "draw.select" },
  { id: "hline", labelKey: "draw.hline" },
  { id: "rect", labelKey: "draw.rect" },
  { id: "fib", labelKey: "draw.fib" },
];

export default function DrawingToolbar({
  tool,
  hasDraft,
  selectedId,
  count,
  onTool,
  onDelete,
  onClear,
}: {
  tool: DrawingTool;
  hasDraft: boolean;
  selectedId: string | null;
  count: number;
  onTool(next: DrawingTool): void;
  onDelete(): void;
  onClear(): void;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-y border-line/60 bg-hull/40 px-4 py-1.5 lg:px-5">
      <span className="mr-1 text-[12px] font-semibold text-mute">{t("draw.tools")}</span>
      {TOOLS.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={tool === item.id}
          onClick={() => onTool(item.id)}
          className={`rounded border px-2.5 py-0.5 text-[12px] font-semibold transition-colors ${
            tool === item.id ? "border-gold bg-deck text-gold" : "border-line text-mute hover:border-mute hover:text-ink"
          }`}
        >
          {t(item.labelKey)}
        </button>
      ))}
      {hasDraft && <span className="ml-2 text-[12px] text-gold">{t("draw.point2")}</span>}
      {!hasDraft && tool !== "select" && (
        <span className="ml-2 text-[12px] text-mute">{tool === "hline" ? t("draw.hintLine") : t("draw.point1")}</span>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        {selectedId && (
          <button type="button" className={`${buttonClass} py-0.5 text-[12px] text-coral`} onClick={onDelete}>
            {t("draw.delete")}
          </button>
        )}
        {count > 0 && (
          <button type="button" className={`${buttonClass} py-0.5 text-[12px]`} onClick={onClear}>
            {t("draw.clear")} ({count})
          </button>
        )}
      </div>
    </div>
  );
}

