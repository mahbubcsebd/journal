import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <LogoMark className="size-10" />
      <div className="grid gap-1.5">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="text-sm text-muted-foreground">The link may be old, or the trade or note was deleted.</p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
