import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium [&_svg]:size-3.5", {
  variants: {
    tone: {
      neutral: "bg-surface-3 text-ink-2",
      brand: "bg-brand-soft text-brand",
      warning: "bg-warning-soft text-warning-ink",
      critical: "bg-critical-soft text-critical-ink",
      outline: "border border-border text-ink-2",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
