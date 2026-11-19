import { ArrowDownRight, ArrowUpRight, ArrowUpDown } from "lucide-react";
import { goldBias, type GoldBias } from "@/lib/news";
import { cn } from "@/lib/utils";

const STYLE = {
  up: { icon: ArrowUpRight, ink: "text-profit", bg: "bg-profit-soft", word: "up" },
  down: { icon: ArrowDownRight, ink: "text-loss", bg: "bg-loss-soft", word: "down" },
  volatile: { icon: ArrowUpDown, ink: "text-warning-ink", bg: "bg-warning/15", word: "volatile" },
} as const;

export function goldTitle(b: GoldBias) {
  const lead =
    b.basis === "actual" ? "Gold after the release" : b.basis === "forecast" ? "Gold if the forecast is right" : "Gold around this release";
  return `${lead}: ${b.dir === "volatile" ? "big move either way" : `likely ${b.dir}`}. ${b.why} A rule of thumb, not a prediction.`;
}

/** Gold (XAUUSD) arrow for a USD release: ▲ up, ▼ down, ⇅ volatile — icon and word, not colour alone. */
export function GoldSign({
  event,
  compact = false,
  className,
}: {
  event: Parameters<typeof goldBias>[0];
  compact?: boolean;
  className?: string;
}) {
  const b = goldBias(event);
  if (!b) return null;
  const s = STYLE[b.dir];
  const Icon = s.icon;
  return (
    <span
      title={goldTitle(b)}
      aria-label={goldTitle(b)}
      className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", s.bg, s.ink, className)}
    >
      <span aria-hidden className={cn(compact && "max-sm:hidden")}>
        XAU
      </span>
      {compact && (
        <span aria-hidden className="sm:hidden">
          Au
        </span>
      )}
      <Icon className="size-3.5" aria-hidden />
      {!compact && <span aria-hidden className="font-medium">{s.word}</span>}
    </span>
  );
}
