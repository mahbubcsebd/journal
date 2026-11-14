import { Sparkles } from "lucide-react";
import { Suspense } from "react";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/session";

async function Guard() {
  await requireUser();
  return null;
}

/** Placeholder for sections scheduled in a later build phase. */
export function ComingSoon({ phase, features }: { phase: string; features: string[] }) {
  return (
    <FadeIn delay={0.05} className="relative overflow-hidden rounded-2xl border border-dashed bg-card/60 p-8 sm:p-10">
      <Suspense>
        <Guard />
      </Suspense>
      <div className="absolute -top-24 -right-24 size-64 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative grid max-w-2xl gap-5">
        <Badge variant="brand" className="w-fit">
          <Sparkles className="size-3" /> Planned · {phase}
        </Badge>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </FadeIn>
  );
}
