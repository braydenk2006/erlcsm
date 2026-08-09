import { buildActorForUser } from "@commandry/api";
import { getErlcIntegration } from "@commandry/integrations";
import { authorize } from "@commandry/permissions";
import { EmptyState } from "@commandry/ui";
import { IntegrationHub } from "@/components/integrations/integration-hub";
import { requireActiveOrganization } from "@/lib/organization";
import { hasFeature } from "@/lib/entitlements";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { userId, organizationId, organization } = await requireActiveOrganization();
  const actor = await buildActorForUser(userId, organizationId);
  if (!authorize({ actor, organizationId, action: "integrations.view" }).allowed) {
    return (
      <EmptyState
        title="No access"
        description="You do not have permission to manage integrations."
      />
    );
  }

  const [integration, canDiscord, canWebhooks, canApiKeys] = await Promise.all([
    getErlcIntegration(organizationId),
    hasFeature(organizationId, "discord.integration"),
    hasFeature(organizationId, "webhooks.basic"),
    hasFeature(organizationId, "api.public"),
  ]);

  return (
    <IntegrationHub
      orgPublicId={organization.publicId}
      canDiscord={canDiscord}
      canWebhooks={canWebhooks}
      canApiKeys={canApiKeys}
      erlcInitial={{
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
  );
}
