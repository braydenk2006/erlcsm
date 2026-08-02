import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-[999px] px-3 py-1 text-xs font-semibold uppercase tracking-wide",
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
          "bg-[linear-gradient(135deg,rgba(59,108,255,0.22),rgba(168,85,247,0.22))] text-[#d7deff] border border-[rgba(109,140,255,0.35)]",
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
