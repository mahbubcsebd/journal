import { T } from "@/components/i18n/t";
import { FadeIn } from "@/components/motion/fade-in";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <FadeIn className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>{title}</T>
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">
            <T>{description}</T>
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </FadeIn>
  );
}
