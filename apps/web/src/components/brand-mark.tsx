import Image from "next/image";
import { cn } from "@commandry/ui";

export function BrandMark({
  size = 40,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/icons/commandry-logo.png"
      alt="Commandry"
      width={size}
      height={size}
      priority={priority}
      className={cn("select-none rounded-full", className)}
    />
  );
}

export function BrandLockup({
  size = 36,
  className,
  subtitle,
}: {
  size?: number;
  className?: string;
  subtitle?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark size={size} className="cmd-crest-glow" />
      <div className="min-w-0">
        <p className="font-[family-name:var(--cmd-font-display)] text-xl font-semibold tracking-[0.04em]">
          Commandry
        </p>
        {subtitle ? (
          <p className="truncate text-xs text-[var(--cmd-fg-muted)]">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
