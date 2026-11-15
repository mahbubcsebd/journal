"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Sheet, SheetContent, SheetTitle } from "./sheet";

/**
 * A popover on desktop and a bottom sheet on phones — the shell for every
 * picker (Combobox, account switcher). On phones nothing is focused on open,
 * so the keyboard only appears if the user taps the search box.
 */
export function ResponsivePopover({
  open,
  onOpenChange,
  trigger,
  title,
  children,
  className,
  align = "start",
  id,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  /** Heading of the bottom sheet (and its accessible name). */
  title: string;
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  id?: string;
}) {
  const mobile = useIsMobile();

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
        <SheetContent
          id={id}
          side="bottom"
          showCloseButton={false}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="p-0"
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25" aria-hidden />
          <SheetTitle className="px-5 pt-3 pb-1 text-sm">{title}</SheetTitle>
          <div className="min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom)] [&_[cmdk-list]]:max-h-[60dvh] [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:text-[15px]">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent id={id} align={align} className={cn("p-0", className)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
