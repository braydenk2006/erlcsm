import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--cmd-radius-pill)] text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cmd-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cmd-bg)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "cmd-gradient-fill shadow-[0_12px_28px_rgba(255,59,92,0.32)] hover:brightness-110",
        secondary:
          "bg-[var(--cmd-bg-muted)] text-[var(--cmd-fg)] border border-[var(--cmd-border)] hover:border-[rgba(255,79,216,0.4)]",
        ghost: "bg-transparent text-[var(--cmd-fg)] hover:bg-[var(--cmd-bg-muted)]",
        danger: "bg-[var(--cmd-danger)] text-white hover:brightness-110",
        outline:
          "border border-[var(--cmd-border)] bg-[rgba(255,255,255,0.03)] text-[var(--cmd-fg)] hover:border-[rgba(45,226,197,0.45)] hover:bg-[rgba(45,226,197,0.08)]",
        cool: "cmd-gradient-cool shadow-[0_12px_28px_rgba(45,226,197,0.22)] hover:brightness-110",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-5",
        lg: "h-12 px-7 text-base",
        icon: "h-11 w-11 rounded-full p-0",
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
