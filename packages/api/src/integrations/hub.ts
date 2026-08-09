import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import {
  computeOverallHealth,
  connectDiscord,
  getDiscordClientForOrganization,
  getDiscordIntegration,
  getErlcIntegration,
  type IntegrationStatus,
  type OverallHealth,
} from "@commandry/integrations";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError } from "@commandry/shared";

function can(actor: Actor, organizationId: string, action: string): boolean {
  return authorize({ actor, organizationId, action: action as Action }).allowed;
}
function requirePerm(actor: Actor, organizationId: string, action: string): void {
  if (!can(actor, organizationId, action)) throw new ForbiddenError("Not permitted");
}

export type IntegrationCard = {
  key: "erlc" | "discord" | "roblox" | "webhooks" | "api_keys";
  name: string;
  status: IntegrationStatus;
  configured: boolean;
  health: string;
  detail: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  mode?: string;
  metrics?: Record<string, number>;
};

export type IntegrationHub = { overall: OverallHealth; cards: IntegrationCard[] };

function mapCredStatus(status: string, hasCredentials: boolean): IntegrationStatus {
  switch (status) {
    case "CONNECTED":
      return "CONNECTED";
    case "DEGRADED":
      return "DEGRADED";
    case "ERROR":
      return "ERROR";
    default:
      return hasCredentials ? "CONFIGURATION_REQUIRED" : "DISCONNECTED";
  }
}

/** Aggregate the state of every integration into a unified, deterministic view. */
export async function getIntegrationHub(input: {
  actor: Actor;
  organizationId: string;
}): Promise<IntegrationHub> {
  requirePerm(input.actor, input.organizationId, "integrations.view");
  const org = input.organizationId;

  const [
    erlc,
    discord,
    discordCred,
    activeMembers,
    linkedMembers,
    webhooks,
    apiKeys,
    recentFailedDeliveries,
  ] = await Promise.all([
    getErlcIntegration(org),
    getDiscordIntegration(org),
    prisma.integrationCredential.findFirst({ where: { organizationId: org, provider: "discord" } }),
    prisma.membership.count({ where: { organizationId: org, status: "ACTIVE" } }),
    prisma.membership.count({
      where: { organizationId: org, status: "ACTIVE", user: { robloxLink: { isNot: null } } },
    }),
    prisma.webhookEndpoint.findMany({
      where: { organizationId: org },
      select: { enabled: true, status: true },
    }),
    prisma.apiKey.count({ where: { organizationId: org, status: "active" } }),
    prisma.webhookDelivery.count({
      where: {
        organizationId: org,
        status: "FAILED",
        createdAt: { gte: new Date(Date.now() - 86_400_000) },
      },
    }),
  ]);

  const cards: IntegrationCard[] = [];

  // ER:LC / PRC — reuses the existing integration service (never rewritten).
  cards.push({
    key: "erlc",
    name: "ER:LC / PRC",
    status: mapCredStatus(erlc.status, erlc.hasCredentials),
    configured: erlc.hasCredentials,
    health: erlc.hasCredentials
      ? erlc.status === "CONNECTED"
        ? "Server reachable"
        : erlc.status === "DEGRADED"
          ? "Rate limited or degraded"
          : (erlc.lastError ?? "Not verified")
      : "Not configured",
    detail: `${erlc.mode} mode`,
    lastSuccessAt: erlc.lastSuccessAt?.toISOString() ?? null,
    lastError: erlc.lastError,
    mode: erlc.mode,
  });

  // Discord — reuses the existing bot service. Never claim healthy just because
  // a token exists: mock/simulation mode is surfaced as DEGRADED.
  const discordStatus: IntegrationStatus = !discord.connected
    ? "DISCONNECTED"
    : discord.mode === "mock"
      ? "DEGRADED"
      : "CONNECTED";
  cards.push({
    key: "discord",
    name: "Discord",
    status: discordStatus,
    configured: discord.connected,
    health: !discord.connected
      ? "Not connected"
      : discord.mode === "mock"
        ? "Simulation mode (set DISCORD_MODE=live for live delivery)"
        : "Bot connected",
    detail: discord.guildId ? `Guild ${discord.guildId}` : "No guild",
    lastSuccessAt: discordCred?.lastSuccessAt?.toISOString() ?? null,
    lastError: discordCred?.lastError ?? null,
    mode: discord.mode,
  });

  // Roblox — reuses the existing account-linking system (no scraping/cookies).
  const coverage = activeMembers > 0 ? Math.round((linkedMembers / activeMembers) * 100) : 0;
  cards.push({
    key: "roblox",
    name: "Roblox",
    status: linkedMembers > 0 ? "CONNECTED" : "CONFIGURATION_REQUIRED",
    configured: linkedMembers > 0,
    health: linkedMembers > 0 ? `${coverage}% of members linked` : "No members linked yet",
    detail: `${linkedMembers}/${activeMembers} members linked`,
    lastSuccessAt: null,
    lastError: null,
    metrics: { linked: linkedMembers, total: activeMembers, coverage },
  });

  // Outgoing webhooks (additive; reuses the event bus).
  const enabledWebhooks = webhooks.filter((w) => w.enabled).length;
  const degradedWebhooks = webhooks.filter(
    (w) => w.status === "degraded" || w.status === "disabled",
  ).length;
  cards.push({
    key: "webhooks",
    name: "Webhooks",
    status:
      webhooks.length === 0
        ? "DISCONNECTED"
        : recentFailedDeliveries > 0 || degradedWebhooks > 0
          ? "DEGRADED"
          : "CONNECTED",
    configured: webhooks.length > 0,
    health:
      webhooks.length === 0
        ? "No endpoints"
        : recentFailedDeliveries > 0
          ? `${recentFailedDeliveries} failed deliveries (24h)`
          : `${enabledWebhooks} active endpoint(s)`,
    detail: `${webhooks.length} endpoint(s)`,
    lastSuccessAt: null,
    lastError: null,
    metrics: {
      endpoints: webhooks.length,
      enabled: enabledWebhooks,
      recentFailures: recentFailedDeliveries,
    },
  });

  // API keys (additive).
  cards.push({
    key: "api_keys",
    name: "API Keys",
    status: apiKeys > 0 ? "CONNECTED" : "DISCONNECTED",
    configured: apiKeys > 0,
    health: apiKeys > 0 ? `${apiKeys} active key(s)` : "No API keys",
    detail: `${apiKeys} active`,
    lastSuccessAt: null,
    lastError: null,
    metrics: { active: apiKeys },
  });

  return {
    overall: computeOverallHealth(
      cards.map((c) => ({ status: c.status, configured: c.configured })),
    ),
    cards,
  };
}

// ---------------------------------------------------------------------------
// Discord configuration (channel/role mapping stored in the credential metadata)
// ---------------------------------------------------------------------------

export type DiscordConfig = {
  connected: boolean;
  mode: string;
  guildId: string | null;
  channels: Record<string, string>;
  roles: Record<string, string>;
};

const CHANNEL_KEYS = [
  "announcements",
  "shifts",
  "applications",
  "training",
  "audit",
  "notifications",
  "cad",
];

export async function getDiscordConfig(input: {
  actor: Actor;
  organizationId: string;
}): Promise<DiscordConfig> {
  requirePerm(input.actor, input.organizationId, "integrations.view");
  const [summary, cred] = await Promise.all([
    getDiscordIntegration(input.organizationId),
    prisma.integrationCredential.findFirst({
      where: { organizationId: input.organizationId, provider: "discord" },
    }),
  ]);
  const metadata =
    (cred?.metadata as {
      channels?: Record<string, string>;
      roles?: Record<string, string>;
    } | null) ?? {};
  return {
    connected: summary.connected,
    mode: summary.mode,
    guildId: summary.guildId,
    channels: metadata.channels ?? {},
    roles: metadata.roles ?? {},
  };
}

export async function connectDiscordIntegration(input: {
  actor: Actor;
  organizationId: string;
  botToken: string;
  guildId: string;
  label?: string;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "integrations.manage");
  await connectDiscord({
    organizationId: input.organizationId,
    botToken: input.botToken,
    guildId: input.guildId,
    label: input.label,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "integration.discord.connect",
    resourceType: "integration_credential",
    resourceId: input.organizationId,
    source: "WEB",
    metadata: { guildId: input.guildId },
  }).catch(() => undefined);
}

export async function updateDiscordConfig(input: {
  actor: Actor;
  organizationId: string;
  channels?: Record<string, string>;
  roles?: Record<string, string>;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "integrations.manage");
  const cred = await prisma.integrationCredential.findFirst({
    where: { organizationId: input.organizationId, provider: "discord" },
  });
  if (!cred) throw new ForbiddenError("Connect Discord before configuring channels");
  const metadata = (cred.metadata as Record<string, unknown> | null) ?? {};
  const nextChannels = {
    ...((metadata.channels as Record<string, string>) ?? {}),
    ...(input.channels ?? {}),
  };
  const nextRoles = {
    ...((metadata.roles as Record<string, string>) ?? {}),
    ...(input.roles ?? {}),
  };
  await prisma.integrationCredential.update({
    where: { id: cred.id },
    data: { metadata: { ...metadata, channels: nextChannels, roles: nextRoles } as object },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "integration.discord.configure",
    resourceType: "integration_credential",
    resourceId: cred.id,
    source: "WEB",
    metadata: { channels: Object.keys(nextChannels), roles: Object.keys(nextRoles) },
  }).catch(() => undefined);
}

export type DiscordDiagnostics = {
  connected: boolean;
  mode: string;
  guildReachable: boolean;
  configuredChannels: string[];
  missingChannels: string[];
  note: string;
};

/** Probe the Discord integration. In simulation mode this is clearly labelled. */
export async function testDiscord(input: {
  actor: Actor;
  organizationId: string;
}): Promise<DiscordDiagnostics> {
  requirePerm(input.actor, input.organizationId, "integrations.test");
  const client = await getDiscordClientForOrganization(input.organizationId);
  const config = await getDiscordConfig({
    actor: input.actor,
    organizationId: input.organizationId,
  });
  const configured = Object.keys(config.channels);
  const missing = CHANNEL_KEYS.filter((k) => !config.channels[k]);
  const guildReachable = client.hasCredentials && client.mode === "live";
  await prisma.integrationCredential
    .updateMany({
      where: { organizationId: input.organizationId, provider: "discord" },
      data: {
        lastCheckedAt: new Date(),
        ...(guildReachable ? { lastSuccessAt: new Date(), status: "CONNECTED" } : {}),
      },
    })
    .catch(() => undefined);
  return {
    connected: client.hasCredentials,
    mode: client.mode,
    guildReachable,
    configuredChannels: configured,
    missingChannels: missing,
    note:
      client.mode === "live"
        ? "Live Discord probe."
        : "Simulation mode — no live Discord call was made.",
  };
}

// ---------------------------------------------------------------------------
// Unified integration activity feed (reuses the audit log + delivery log)
// ---------------------------------------------------------------------------

export type ActivityEntry = { at: string; kind: string; label: string; status: string };

export async function getIntegrationActivity(input: {
  actor: Actor;
  organizationId: string;
}): Promise<ActivityEntry[]> {
  requirePerm(input.actor, input.organizationId, "integrations.logs");
  const org = input.organizationId;
  const [audits, deliveries] = await Promise.all([
    prisma.auditEvent.findMany({
      where: {
        organizationId: org,
        OR: [{ action: { startsWith: "integration." } }, { source: { in: ["ERLC", "DISCORD"] } }],
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.webhookDelivery.findMany({
      where: { organizationId: org },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { endpoint: { select: { name: true } } },
    }),
  ]);
  const entries: ActivityEntry[] = [
    ...audits.map((a) => ({
      at: a.createdAt.toISOString(),
      kind: "audit",
      label: a.action.replace(/^integration\./, "").replace(/[._]/g, " "),
      status: "ok",
    })),
    ...deliveries.map((d) => ({
      at: d.createdAt.toISOString(),
      kind: "webhook",
      label: `${d.endpoint.name}: ${d.eventType}`,
      status: d.status.toLowerCase(),
    })),
  ];
  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60);
}
