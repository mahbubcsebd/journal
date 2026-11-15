"use client";

import { motion } from "motion/react";
import { CalendarDays, ChartNoAxesCombined, LayoutDashboard, ListOrdered, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NavList } from "./sidebar";

const TABS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/trades", label: "Trades", icon: ListOrdered },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
] as const;

/** App-style tab bar on phones and tablets; "More" opens the full menu. */
export function BottomNav() {
  return (
    <Suspense fallback={<Bar pathname={null} />}>
      <ActiveBar />
    </Suspense>
  );
}

function ActiveBar() {
  return <Bar pathname={usePathname()} />;
}

function Bar({ pathname }: { pathname: string | null }) {
  const [more, setMore] = useState(false);
  const inTabs = TABS.some((t) => pathname === t.href || pathname?.startsWith(t.href + "/"));

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden print:hidden"
      >
        <div className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {TABS.map((t) => {
            const active = pathname != null && (pathname === t.href || pathname.startsWith(t.href + "/"));
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:scale-95",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-active"
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-brand"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <t.icon className={cn("size-[22px]", active && "text-brand-ink")} strokeWidth={active ? 2.2 : 1.8} />
                {t.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMore(true)}
            aria-label="More pages"
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:scale-95",
              !inTabs && pathname ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {!inTabs && pathname && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" />}
            <Menu className={cn("size-[22px]", !inTabs && pathname && "text-brand-ink")} strokeWidth={1.8} />
            More
          </button>
        </div>
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="left" className="bg-sidebar lg:hidden" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-16 shrink-0 items-center px-5 pt-[env(safe-area-inset-top)]">
            <Logo />
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <NavList layoutKey="mobile" onNavigate={() => setMore(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
