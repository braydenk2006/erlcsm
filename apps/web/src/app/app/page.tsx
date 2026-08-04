import Link from "next/link";
import { listMembershipsForUser } from "@commandry/api";
import { Badge, Button, EmptyState } from "@commandry/ui";
import { requireSession } from "@/lib/session";

export default async function HomePage() {
  const session = await requireSession();
  const memberships = await listMembershipsForUser(session.user.id);
  const activeOrganizationId =
    (session.user as { activeOrganizationId?: string | null }).activeOrganizationId ??
    memberships[0]?.organizationId;
  const active = memberships.find((item) => item.organizationId === activeOrganizationId);

  if (!active) {
    return (
      <EmptyState
        title="Create your first community"
        description="Commandry workspaces are organization-scoped. Start onboarding to configure ranks, departments, and integrations."
        action={
          <Button asChild>
            <Link href="/app/onboarding">Start onboarding</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">Home</p>
        <h1 className="font-[family-name:var(--cmd-font-display)] text-4xl tracking-[-0.03em]">
          {active.organization.name}
        </h1>
        <p className="max-w-2xl text-[var(--cmd-fg-muted)]">
          Permission-aware dashboard for live operations. Widgets only appear when the underlying
          module data is available — never fabricated metrics.
        </p>
      </div>

      <section className="cmd-glass-strong relative overflow-hidden rounded-[var(--cmd-radius-xl)] p-6 md:p-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(120deg,rgba(255,59,92,0.22),rgba(124,92,255,0.18),rgba(45,226,197,0.12))]"
        />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge tone="accent">Now playing</Badge>
            <h2 className="mt-3 font-[family-name:var(--cmd-font-display)] text-3xl tracking-[-0.03em]">
              Community command center
            </h2>
            <p className="mt-2 max-w-xl text-sm text-[var(--cmd-fg-muted)]">
              Jump into setup, integrations, and access controls without leaving the workspace vibe.
            </p>
          </div>
          <Button asChild>
            <Link href="/app/onboarding">Continue setup</Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Setup progress</h2>
            <Badge tone={active.organization.onboardingComplete ? "success" : "warning"}>
              {active.organization.onboardingComplete ? "Ready" : "In progress"}
            </Badge>
          </div>
          <p className="text-sm text-[var(--cmd-fg-muted)]">
            Step {active.organization.onboardingStep} of guided onboarding.
          </p>
          {!active.organization.onboardingComplete ? (
            <Button asChild className="mt-4" variant="secondary">
              <Link href="/app/onboarding">Continue setup</Link>
            </Button>
          ) : null}
        </section>

        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-6">
          <h2 className="mb-3 font-semibold">Integration health</h2>
          <p className="text-sm text-[var(--cmd-fg-muted)]">
            Discord, Roblox, and ER:LC connections are managed from Integrations. No live connection
            is claimed until credentials are validated.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/app/integrations">Open integrations</Link>
          </Button>
        </section>

        <section className="cmd-glass rounded-[var(--cmd-radius-xl)] p-6">
          <h2 className="mb-3 font-semibold">Your access</h2>
          <ul className="space-y-2 text-sm text-[var(--cmd-fg-muted)]">
            {active.roles.map((item) => (
              <li key={item.roleId}>
                <Badge tone="accent">{item.role.name}</Badge>
              </li>
            ))}
          </ul>
          <Button asChild className="mt-4" variant="ghost">
            <Link href="/app/settings/permissions">Permission simulator</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
