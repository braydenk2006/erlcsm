import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--cmd-radius)] text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cmd-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cmd-bg)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "cmd-gradient-fill shadow-[0_10px_30px_rgba(59,108,255,0.28)] hover:brightness-110",
        secondary:
          "bg-[var(--cmd-bg-muted)] text-[var(--cmd-fg)] border border-[var(--cmd-border)] hover:border-[rgba(109,140,255,0.45)]",
        ghost: "bg-transparent text-[var(--cmd-fg)] hover:bg-[var(--cmd-bg-muted)]",
        danger: "bg-[var(--cmd-danger)] text-white hover:brightness-110",
        outline:
          "border border-[var(--cmd-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cmd-fg)] hover:border-[rgba(168,85,247,0.45)] hover:bg-[rgba(139,92,246,0.08)]",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-11 px-4",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";
