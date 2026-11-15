"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { DialogsProvider } from "./ui/confirm-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <DialogsProvider>{children}</DialogsProvider>
        <Toaster
          position="bottom-right"
          // Above the mobile tab bar.
          mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
          toastOptions={{
            classNames: {
              toast: "!rounded-xl !border !border-border !bg-popover !text-foreground !shadow-pop",
              description: "!text-muted-foreground",
            },
          }}
        />
      </MotionConfig>
    </ThemeProvider>
  );
}
