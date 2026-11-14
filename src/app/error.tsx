"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-5 px-6 text-center">
      <LogoMark className="size-10" />
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your data is safe. Try again — if it keeps happening, the database or a connected service may be briefly unavailable.
        </p>
        {error.digest && <p className="font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
