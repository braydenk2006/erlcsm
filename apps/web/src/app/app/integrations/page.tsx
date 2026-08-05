import { getErlcIntegration } from "@commandry/integrations";
import { ErlcConnectForm } from "@/components/integrations/erlc-connect-form";
import { requireActiveOrganization } from "@/lib/organization";
import { hasFeature } from "@/lib/entitlements";
import { PlanRequired } from "@/components/plan-required";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const { organizationId, organization } = await requireActiveOrganization();
  if (!(await hasFeature(organizationId, "server.health_monitoring"))) {
    return <PlanRequired feature="server.health_monitoring" />;
  }
  const integration = await getErlcIntegration(organizationId);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--cmd-fg-muted)]">
          Integrations
        </p>
        <h1 className="mt-1 font-[family-name:var(--cmd-font-display)] text-4xl tracking-tight">
          Connections
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--cmd-fg-muted)]">
          Connect Ordinex to your ER:LC server. Credentials are encrypted at rest; health is
          monitored continuously with automatic rate-limit and outage handling.
        </p>
      </div>

      <ErlcConnectForm
        orgPublicId={organization.publicId}
        initial={{
          connected: integration.connected,
          mode: integration.mode,
          status: integration.status,
          label: integration.label,
          hasCredentials: integration.hasCredentials,
          webhookConfigured: integration.webhookConfigured,
          lastCheckedAt: integration.lastCheckedAt ? integration.lastCheckedAt.toISOString() : null,
          lastSuccessAt: integration.lastSuccessAt ? integration.lastSuccessAt.toISOString() : null,
          lastError: integration.lastError,
        }}
      />
    </div>
  );
}
