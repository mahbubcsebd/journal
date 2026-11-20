"use client";

import { LogOut, Moon, Settings, Sun, Wallet } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";
import { initials } from "@/lib/utils";
import { useT } from "@/components/i18n/t";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand/80 to-[oklch(0.55_0.14_220)] text-xs font-semibold text-white ring-2 ring-background transition hover:brightness-110"
      >
        {initials(name || email)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          <span className="text-sm font-medium text-foreground">{name || "Trader"}</span>
          <span className="truncate">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/accounts"><Wallet /> {t("Trading accounts")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings"><Settings /> {t("Settings")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="sm:hidden"
          onSelect={(e) => {
            e.preventDefault();
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
          }}
        >
          {resolvedTheme === "dark" ? <Sun /> : <Moon />} {t(resolvedTheme === "dark" ? "Light theme" : "Dark theme")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            // Full page load so nothing from this session stays in the client cache.
            window.location.replace("/login");
          }}
        >
          <LogOut /> {t("Sign out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
