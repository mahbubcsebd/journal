"use client";

import { Ban, CirclePause, CirclePlay, LogOut, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { setUserStatus, signOutEverywhere } from "@/server/actions/admin";

const DURATIONS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "0", label: "Until I reopen it" },
];

/** Pause, ban, reopen and sign-out controls for one user (buttons, or a ⋯ menu in tables). */
export function UserActions({
  userId,
  email,
  blocked,
  isSelf,
  compact = false,
}: {
  userId: string;
  email: string;
  /** Current effective status. */
  blocked: "paused" | "banned" | null;
  isSelf: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<null | "paused" | "banned">(null);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");

  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message);
        setDialog(null);
        setReason("");
        router.refresh();
      } else toast.error(r.error);
    });

  const reopen = async () => {
    const ok = await confirm({ title: `Reopen ${email}?`, description: "They can sign in and sync again right away.", confirmLabel: "Reopen account" });
    if (ok) run(() => setUserStatus(userId, { status: "active" }));
  };
  const signOut = async () => {
    const ok = await confirm({ title: `Sign ${email} out everywhere?`, description: "Every browser and phone is signed out. They can sign in again.", confirmLabel: "Sign out" });
    if (ok) run(() => signOutEverywhere(userId));
  };

  const dialogs = (
    <Dialog open={dialog != null} onOpenChange={(v) => !v && setDialog(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialog === "banned" ? `Ban ${email}?` : `Pause ${email}?`}</DialogTitle>
          <DialogDescription>
            {dialog === "banned"
              ? "They are signed out everywhere, can't sign in, and their MT5 EA stops syncing. Their data is kept. You can reopen the account later."
              : "They are signed out and can't sign in or sync until the pause ends or you reopen the account. Their data is kept."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              dialog === "banned"
                ? setUserStatus(userId, { status: "banned", reason })
                : setUserStatus(userId, { status: "paused", reason: reason || undefined, days: Number(days) }),
            );
          }}
        >
          {dialog === "paused" && (
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">How long</span>
              <Combobox value={days} onValueChange={setDays} options={DURATIONS} />
            </label>
          )}
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Reason {dialog === "paused" && <span className="font-normal text-muted-foreground">(optional)</span>}</span>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Shown to the user when they try to sign in" required={dialog === "banned"} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" variant={dialog === "banned" ? "destructive" : "default"} disabled={pending}>
              {dialog === "banned" ? "Ban account" : "Pause account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (compact) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${email}`} disabled={pending}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {blocked ? (
              <DropdownMenuItem onSelect={() => void reopen()}>
                <CirclePlay /> Reopen
              </DropdownMenuItem>
            ) : (
              !isSelf && (
                <>
                  <DropdownMenuItem onSelect={() => setDialog("paused")}>
                    <CirclePause /> Pause
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-loss" onSelect={() => setDialog("banned")}>
                    <Ban /> Ban
                  </DropdownMenuItem>
                </>
              )
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut /> Sign out everywhere
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {dialogs}
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {blocked ? (
        <Button variant="brand" size="sm" onClick={() => void reopen()} disabled={pending}>
          <CirclePlay /> Reopen account
        </Button>
      ) : (
        !isSelf && (
          <>
            <Button variant="outline" size="sm" onClick={() => setDialog("paused")} disabled={pending}>
              <CirclePause /> Pause
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDialog("banned")} disabled={pending}>
              <Ban /> Ban
            </Button>
          </>
        )
      )}
      <Button variant="ghost" size="sm" onClick={() => void signOut()} disabled={pending}>
        <LogOut /> Sign out everywhere
      </Button>
      {dialogs}
    </div>
  );
}
