import Link from "next/link";
import { Badge } from "@commandry/ui";
import { BrandLockup } from "@/components/brand-mark";

const RELEASES = [
  { name: "Release 0 — Repository & architecture", status: "in_progress" },
  { name: "Release 1 — Tenant & identity foundation", status: "in_progress" },
  { name: "Release 2 — Operations core", status: "planned" },
  { name: "Release 3 — Recruitment & development", status: "planned" },
  { name: "Release 4 — Governance", status: "planned" },
  { name: "Release 5 — Live ER:LC & Discord", status: "planned" },
  { name: "Release 6 — CAD", status: "planned" },
  { name: "Release 7 — Growth platform", status: "planned" },
  { name: "Release 8 — AI", status: "planned" },
] as const;

export default function StatusPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <BrandLockup size={48} subtitle="Implementation status" />
      <ul className="mt-8 space-y-3">
        {RELEASES.map((release) => (
          <li
            key={release.name}
            className="cmd-glass flex items-center justify-between gap-3 rounded-[var(--cmd-radius-pill)] px-5 py-3.5"
          >
            <span>{release.name}</span>
            <Badge tone={release.status === "in_progress" ? "warning" : "neutral"}>
              {release.status}
            </Badge>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-[var(--cmd-fg-muted)]">
        See <Link href="/">docs/IMPLEMENTATION_STATUS.md</Link> in the repository for the
        authoritative checklist. Unfinished modules are never presented as live capabilities.
      </p>
    </main>
  );
}
