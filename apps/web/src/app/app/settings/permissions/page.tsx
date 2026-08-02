import { listMembershipsForUser, buildActorForUser } from "@commandry/api";
import { explainAccess, ACTIONS } from "@commandry/permissions";
import { Badge, EmptyState } from "@commandry/ui";
import { requireSession } from "@/lib/session";

export default async function PermissionSimulatorPage() {
  const session = await requireSession();
  const memberships = await listMembershipsForUser(session.user.id);
  const activeOrganizationId =
    (session.user as { activeOrganizationId?: string | null }).activeOrganizationId ??
    memberships[0]?.organizationId;

  if (!activeOrganizationId) {
    return (
      <EmptyState
        title="No organization selected"
        description="Create or join an organization before using the permission simulator."
      />
    );
  }

  const actor = await buildActorForUser(session.user.id, activeOrganizationId);
  const sampleActions = ACTIONS.filter((action) =>
    [
      "organization:update",
      "member:invite",
      "role:manage",
      "moderation:create",
      "erlc:command",
      "cad:dispatch",
    ].includes(action),
  ).map((action) => ({
    action,
    ...explainAccess(actor, action),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--cmd-font-display)] text-4xl">
          Permission simulator
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--cmd-fg-muted)]">
          Explains what the current membership can access and which role or grant supplied that
          access. Server-side authorization remains authoritative.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--cmd-border)] bg-[var(--cmd-bg-elevated)] p-5">
        <h2 className="font-semibold">Current actor</h2>
        <p className="mt-2 text-sm text-[var(--cmd-fg-muted)]">
          Roles: {actor.roleKeys.join(", ") || "none"}
        </p>
      </div>

      <ul className="space-y-3">
        {sampleActions.map((item) => (
          <li
            key={item.action}
            className="rounded-2xl border border-[var(--cmd-border)] bg-[var(--cmd-bg-elevated)] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="font-[family-name:var(--cmd-font-mono)] text-sm">{item.action}</code>
              <Badge tone={item.allowed ? "success" : "danger"}>
                {item.allowed ? "allowed" : "denied"}
              </Badge>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--cmd-fg-muted)]">
              {item.why.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
