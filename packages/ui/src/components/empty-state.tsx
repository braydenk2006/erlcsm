import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "cmd-glass flex flex-col items-start gap-3 rounded-[var(--cmd-radius)] border-dashed p-6",
        className,
      )}
    >
      <h3 className="font-[family-name:var(--cmd-font-display)] text-xl text-[var(--cmd-fg)]">
        {title}
      </h3>
      {description ? (
        <p className="max-w-xl text-sm text-[var(--cmd-fg-muted)]">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
