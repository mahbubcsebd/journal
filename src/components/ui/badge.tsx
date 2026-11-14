import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        outline: "border text-muted-foreground",
        profit: "bg-profit-soft text-profit",
        loss: "bg-loss-soft text-loss",
        brand: "bg-brand-soft text-brand-ink",
        warning: "bg-warning/15 text-warning-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
