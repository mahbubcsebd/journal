"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { COACH_TEXT, type CoachLang } from "./i18n";
import { PreTradeDialog, type PreTradeAccount } from "./pretrade-dialog";

export function PreTradeButton({ accounts, symbols, lang }: { accounts: PreTradeAccount[]; symbols: string[]; lang: CoachLang }) {
  const [open, setOpen] = useState(false);
  if (!accounts.length) return null;
  return (
    <>
      <Button variant="brand" size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck /> {COACH_TEXT[lang].preTrade}
      </Button>
      <PreTradeDialog open={open} onOpenChange={setOpen} accounts={accounts} symbols={symbols} lang={lang} />
    </>
  );
}
