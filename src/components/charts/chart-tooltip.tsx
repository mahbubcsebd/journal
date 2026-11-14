import { cn } from "@/lib/utils";

export function ChartTooltip({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; tone?: number; swatch?: string }[];
}) {
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs shadow-pop">
      <p className="mb-1.5 font-medium">{title}</p>
      <div className="grid gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {r.swatch && <span className="size-2 rounded-sm" style={{ background: r.swatch }} />}
              {r.label}
            </span>
            <span
              className={cn(
                "font-mono font-medium tabular",
                r.tone != null && (r.tone > 0 ? "text-profit" : r.tone < 0 ? "text-loss" : ""),
              )}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
