"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteChallenge } from "@/server/actions/challenges";

export function DeleteChallenge({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-loss hover:bg-loss-soft hover:text-loss"
      onClick={() => confirm("Delete this challenge? Trades are not affected.") && start(() => deleteChallenge(id))}
    >
      <Trash2 /> Delete
    </Button>
  );
}
