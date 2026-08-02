"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function OrganizationSwitcher({
  organizations,
  activeOrganizationId,
}: {
  organizations: Array<{ id: string; publicId: string; name: string; slug: string }>;
  activeOrganizationId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (organizations.length === 0) {
    return (
      <a
        href="/app/onboarding"
        className="block rounded-[var(--cmd-radius)] border border-dashed border-[var(--cmd-border)] px-3 py-3 text-sm text-[var(--cmd-fg-muted)]"
      >
        Create your first community
      </a>
    );
  }

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--cmd-fg-muted)]">
        Community
      </span>
      <select
        className="h-12 w-full rounded-[var(--cmd-radius)] border border-[var(--cmd-border)] bg-[var(--cmd-bg-elevated)] px-4"
        disabled={pending}
        value={activeOrganizationId ?? organizations[0]?.id}
        onChange={(event) => {
          const organizationId = event.target.value;
          startTransition(async () => {
            await fetch("/api/organizations/switch", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ organizationId }),
            });
            router.refresh();
          });
        }}
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
    </label>
  );
}
