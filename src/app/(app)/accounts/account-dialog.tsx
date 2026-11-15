"use client";

import { Loader2, Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input } from "@/components/ui/input";
import type { TradingAccount } from "@/db/schema";
import { ACCOUNT_COLORS, EXNESS_ACCOUNT_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { saveAccount, type AccountFormState } from "@/server/actions/accounts";

export function AccountDialog({
  account,
  open: controlledOpen,
  onOpenChange,
}: {
  account?: TradingAccount;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!account && (
        <DialogTrigger asChild>
          <Button>
            <Plus /> Add account
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "Add Exness MT5 account"}</DialogTitle>
          <DialogDescription>
            Find these in Exness Personal Area → My accounts → ⋮ → Account information.
          </DialogDescription>
        </DialogHeader>
        {open && <AccountForm account={account} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AccountForm({ account, onDone }: { account?: TradingAccount; onDone: () => void }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(saveAccount, {});
  const [color, setColor] = useState(account?.color ?? ACCOUNT_COLORS[0]);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) {
      toast.success(account ? "Account updated" : "Account added");
      onDone();
    }
  }, [state, account, onDone]);

  return (
    <form action={action} className="grid gap-4">
      {account && <input type="hidden" name="id" value={account.id} />}
      <input type="hidden" name="color" value={color} />
      <Field label="Nickname" htmlFor="nickname" error={err("nickname")}>
        <Input id="nickname" name="nickname" defaultValue={account?.nickname} placeholder="Gold scalping" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="MT5 login" htmlFor="login" error={err("login")}>
          <Input id="login" name="login" inputMode="numeric" defaultValue={account?.login} placeholder="12345678" required />
        </Field>
        <Field label="Server" htmlFor="server" error={err("server")}>
          <Input id="server" name="server" list="exness-servers" defaultValue={account?.server} placeholder="Exness-MT5Real8" required />
          <datalist id="exness-servers">
            {["Exness-MT5Real", ...Array.from({ length: 30 }, (_, i) => `Exness-MT5Real${i + 2}`), "Exness-MT5Trial", ...Array.from({ length: 15 }, (_, i) => `Exness-MT5Trial${i + 2}`)].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Account type" htmlFor="accountType" error={err("accountType")}>
          <Combobox
            id="accountType"
            name="accountType"
            defaultValue={account?.accountType ?? "Standard"}
            options={EXNESS_ACCOUNT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </Field>
        <Field label="Real or demo" htmlFor="environment">
          <Combobox
            id="environment"
            name="environment"
            defaultValue={account?.environment ?? "REAL"}
            options={[
              { value: "REAL", label: "Real" },
              { value: "DEMO", label: "Demo" },
            ]}
          />
        </Field>
      </div>
      <Field
        label="Starting balance (optional)"
        htmlFor="initialBalance"
        hint="Used for return % until deposits are synced."
        error={err("initialBalance")}
      >
        <Input
          id="initialBalance"
          name="initialBalance"
          type="number"
          step="0.01"
          min="0"
          defaultValue={account?.initialBalance ?? ""}
          placeholder="1000"
        />
      </Field>
      <div className="grid gap-2">
        <span className="text-[13px] font-medium">Colour</span>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              onClick={() => setColor(c)}
              className={cn(
                "size-7 rounded-full ring-offset-2 ring-offset-card transition",
                color === c ? "ring-2 ring-foreground" : "hover:scale-110",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      {state.error && <p className="text-sm text-loss">{state.error}</p>}
      <Button type="submit" disabled={pending} className="mt-1">
        {pending && <Loader2 className="animate-spin" />}
        {account ? "Save changes" : "Add account"}
      </Button>
    </form>
  );
}
