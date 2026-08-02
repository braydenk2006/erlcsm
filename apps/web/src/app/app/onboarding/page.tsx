import { redirect } from "next/navigation";
import { listMembershipsForUser } from "@commandry/api";
import { requireSession } from "@/lib/session";
import { CreateOrganizationForm } from "@/components/create-organization-form";

export default async function OnboardingPage() {
  const session = await requireSession();
  const memberships = await listMembershipsForUser(session.user.id);
  const incomplete = memberships.find((item) => !item.organization.onboardingComplete);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">Onboarding</p>
        <h1 className="mt-2 font-[family-name:var(--cmd-font-display)] text-4xl">
          Launch a Commandry workspace
        </h1>
        <p className="mt-2 text-[var(--cmd-fg-muted)]">
          Progress is saved per organization. Optional integrations can be skipped and completed
          later from Settings.
        </p>
      </div>

      {incomplete ? (
        <div className="rounded-2xl border border-[var(--cmd-border)] bg-[var(--cmd-bg-elevated)] p-6">
          <h2 className="text-lg font-semibold">{incomplete.organization.name}</h2>
          <p className="mt-2 text-sm text-[var(--cmd-fg-muted)]">
            Continue configuration health checks, ranks, departments, and invitations from the
            workspace dashboard. Step {incomplete.organization.onboardingStep}.
          </p>
          <form
            action={async () => {
              "use server";
              redirect("/app");
            }}
          >
            <button className="mt-4 text-sm font-semibold text-[var(--cmd-accent)]" type="submit">
              Return to dashboard
            </button>
          </form>
        </div>
      ) : (
        <CreateOrganizationForm />
      )}
    </div>
  );
}
