import { getCadSettings } from "@commandry/cad";
import { EmptyState } from "@commandry/ui";
import { CadWorkspace } from "@/components/cad/cad-workspace";
import { requireActiveOrganization } from "@/lib/organization";

export const metadata = { title: "CAD / MDT" };

export default async function CadPage() {
  const { organizationId } = await requireActiveOrganization();
  const settings = await getCadSettings(organizationId);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">CAD / MDT</p>
        <h1 className="mt-1 font-[family-name:var(--cmd-font-display)] text-4xl tracking-tight">
          Command &amp; Dispatch
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--cmd-fg-muted)]">
          Command center, dispatch, records, warrants, and BOLOs — synchronized with your ER:LC
          server and governed by Ordinex permissions.
        </p>
      </div>
      {settings.enabled ? (
        <CadWorkspace defaultLanding={settings.defaultLanding} />
      ) : (
        <EmptyState
          title="CAD is disabled for this organization"
          description="An administrator can enable the CAD module from CAD → Configuration."
        />
      )}
    </div>
  );
}
