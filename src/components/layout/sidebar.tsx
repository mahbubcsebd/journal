"use client";

import { motion } from "motion/react";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV } from "./nav-config";

type NavListProps = { layoutKey: string; onNavigate?: () => void };

/**
 * On dynamic routes the pathname is request data, so the active state streams
 * in behind Suspense; the fallback renders the same list with nothing active.
 */
function NavList(props: NavListProps) {
  return (
    <Suspense fallback={<NavLinks {...props} pathname={null} />}>
      <ActiveNavLinks {...props} />
    </Suspense>
  );
}

function ActiveNavLinks(props: NavListProps) {
  return <NavLinks {...props} pathname={usePathname()} />;
}

function NavLinks({ layoutKey, onNavigate, pathname }: NavListProps & { pathname: string | null }) {
  return (
    <nav className="grid gap-6">
      {NAV.map((group) => (
        <div key={group.label} className="grid gap-0.5">
          <p className="px-3 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = pathname != null && (pathname === item.href || pathname.startsWith(item.href + "/"));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId={`nav-active-${layoutKey}`}
                    className="absolute inset-0 rounded-lg border bg-card shadow-soft"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon
                  className={cn(
                    "relative size-[18px] transition-colors",
                    active ? "text-brand-ink" : "text-muted-foreground/80 group-hover:text-foreground",
                  )}
                />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-6">
        <NavList layoutKey="desktop" />
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar lg:hidden" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <NavList layoutKey="mobile" onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
