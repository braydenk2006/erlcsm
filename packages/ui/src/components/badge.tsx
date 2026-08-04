import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--cmd-radius-pill)] px-3 py-1 text-xs font-semibold uppercase tracking-wide",
  {
    variants: {
      tone: {
        neutral: "bg-[var(--cmd-bg-muted)] text-[var(--cmd-fg)] border border-[var(--cmd-border)]",
        success:
          "bg-[color-mix(in_oklab,var(--cmd-success)_18%,transparent)] text-[var(--cmd-success)]",
        warning:
          "bg-[color-mix(in_oklab,var(--cmd-warning)_18%,transparent)] text-[var(--cmd-warning)]",
        danger:
          "bg-[color-mix(in_oklab,var(--cmd-danger)_18%,transparent)] text-[var(--cmd-danger)]",
        accent:
          "bg-[linear-gradient(135deg,rgba(255,59,92,0.22),rgba(124,92,255,0.22))] text-[#ffe4ea] border border-[rgba(255,79,216,0.35)]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
