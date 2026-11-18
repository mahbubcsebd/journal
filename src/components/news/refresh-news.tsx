"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { refreshNews } from "@/server/actions/news";

export function RefreshNews() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await refreshNews();
          if (!r.ok) toast.error(r.error);
          else toast.success(r.refreshed ? "Calendar updated" : "Calendar is already up to date");
          router.refresh();
        })
      }
    >
      <RefreshCw className={cn(pending && "animate-spin")} /> Refresh
    </Button>
  );
}
