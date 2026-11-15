"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteChallenge } from "@/server/actions/challenges";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function DeleteChallenge({ id }: { id: string }) {
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-loss hover:bg-loss-soft hover:text-loss"
      onClick={async () =>
        (await confirm({ title: "Delete this challenge?", description: "Trades are not affected.", destructive: true })) && start(() => deleteChallenge(id))
      }
    >
      <Trash2 /> Delete
    </Button>
  );
}
