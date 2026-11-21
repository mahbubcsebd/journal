"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { revokeUserSyncKey } from "@/server/actions/admin";

export function RevokeKeyButton({ userId, keyId }: { userId: string; keyId: string }) {
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-loss"
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({ title: "Revoke this sync key?", description: "The user's MT5 EA stops syncing until they create a new key.", confirmLabel: "Revoke", destructive: true });
        if (!ok) return;
        start(async () => {
          const r = await revokeUserSyncKey(userId, keyId);
          if (r.ok) {
            toast.success(r.message);
            router.refresh();
          } else toast.error(r.error);
        });
      }}
    >
      Revoke
    </Button>
  );
}
