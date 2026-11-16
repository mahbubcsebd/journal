"use client";

import { Star } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toggleFavoriteChart } from "@/server/actions/profile";

/** Star a chart into the analytics Favorites tab. */
export function FavoriteStar({ id, starred, title }: { id: string; starred: boolean; title: string }) {
  const [on, setOn] = useOptimistic(starred);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${title} from favorites` : `Add ${title} to favorites`}
      title={on ? "Remove from favorites" : "Add to favorites"}
      onClick={() =>
        start(async () => {
          setOn(!on);
          const now = await toggleFavoriteChart(id);
          toast.success(now ? `${title} added to Favorites` : `${title} removed from Favorites`);
        })
      }
      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
    >
      <Star className={cn("size-4", on && "fill-warning text-warning")} />
    </button>
  );
}
