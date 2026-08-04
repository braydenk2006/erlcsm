import * as React from "react";
import { cn } from "../lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-[var(--cmd-radius-pill)] border border-[var(--cmd-border)] bg-[rgba(8,12,24,0.72)] px-5 text-sm text-[var(--cmd-fg)] placeholder:text-[var(--cmd-fg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cmd-ring)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
