import { Ban, CirclePause, CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { blockedStatus } from "@/lib/admin";

/** Account status with icon and words, not colour alone. An expired pause reads as active. */
export function StatusBadge({ status, statusUntil }: { status: string; statusUntil: Date | null }) {
  const s = blockedStatus({ status, statusUntil });
  if (s === "banned")
    return (
      <Badge variant="loss" className="gap-1">
        <Ban className="size-3" /> Banned
      </Badge>
    );
  if (s === "paused")
    return (
      <Badge variant="warning" className="gap-1">
        <CirclePause className="size-3" /> Paused{statusUntil ? ` · ${statusUntil.toISOString().slice(0, 10)}` : ""}
      </Badge>
    );
  return (
    <Badge variant="profit" className="gap-1">
      <CircleCheck className="size-3" /> Active
    </Badge>
  );
}
