import { decryptSecret, encryptSecret, prisma } from "@commandry/database";
import {
  createErlcClient,
  parseCallWebhook,
  resolveErlcMode,
  verifyErlcWebhook,
  type ErlcClient,
  type ErlcHealthResult,
  type ErlcMode,
} from "@commandry/erlc";
import { createPublicId } from "@commandry/shared";

const PROVIDER = "erlc";

type IntegrationStatusValue = "DISCONNECTED" | "CONNECTED" | "DEGRADED" | "ERROR";

/** Secret material stored encrypted at rest for an org's ER:LC connection. */
type ErlcSecretPayload = {
  serverKey: string;
  globalKey?: string;
  webhookSecret?: string;
};

export type ErlcConnectInput = {
  organizationId: string;
  serverKey: string;
  globalKey?: string;
  webhookSecret?: string;
  label?: string;
};

export type ErlcIntegrationSummary = {
  connected: boolean;
  provider: "erlc";
  mode: ErlcMode;
  status: IntegrationStatusValue;
  label: string | null;
  hasCredentials: boolean;
  webhookConfigured: boolean;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
};

export type ErlcResolvedClient = {
  client: ErlcClient;
  mode: ErlcMode;
  hasCredentials: boolean;
};

function healthToStatus(status: ErlcHealthResult["status"]): IntegrationStatusValue {
  switch (status) {
    case "connected":
      return "CONNECTED";
    case "degraded":
      return "DEGRADED";
    case "error":
      return "ERROR";
    default:
      return "DISCONNECTED";
  }
}

async function loadSecret(organizationId: string): Promise<ErlcSecretPayload | null> {
  const credential = await prisma.integrationCredential.findUnique({
    where: { organizationId_provider: { organizationId, provider: PROVIDER } },
  });
  if (!credential) return null;
  try {
    const raw = decryptSecret({
      ciphertext: credential.ciphertext,
      iv: credential.iv,
      authTag: credential.authTag,
    });
    return JSON.parse(raw) as ErlcSecretPayload;
  } catch {
    return null;
  }
}

/**
 * Resolve the ER:LC client for an organization. Uses the live PRC client when
 * `ERLC_MODE=live` and credentials exist; otherwise returns a per-org seeded
 * simulator so the live-server features work without external credentials.
 */
export async function getErlcClientForOrganization(
  organizationId: string,
): Promise<ErlcResolvedClient> {
  const mode = resolveErlcMode(process.env.ERLC_MODE);
  const secret = await loadSecret(organizationId);

  if (mode === "live" && secret?.serverKey) {
    return {
      client: createErlcClient({
        mode: "live",
        serverKey: secret.serverKey,
        ...(secret.globalKey ? { globalKey: secret.globalKey } : {}),
      }),
      mode: "live",
      hasCredentials: true,
    };
  }

  return {
    client: createErlcClient({ mode: "simulator", seed: organizationId }),
    mode: "simulator",
    hasCredentials: Boolean(secret?.serverKey),
  };
}

/** Store (encrypted) ER:LC credentials for an org and validate via a health check. */
export async function connectErlc(input: ErlcConnectInput): Promise<ErlcIntegrationSummary> {
  const payload: ErlcSecretPayload = {
    serverKey: input.serverKey.trim(),
    ...(input.globalKey ? { globalKey: input.globalKey.trim() } : {}),
    ...(input.webhookSecret ? { webhookSecret: input.webhookSecret.trim() } : {}),
  };
  const encrypted = encryptSecret(JSON.stringify(payload));

  await prisma.integrationCredential.upsert({
    where: { organizationId_provider: { organizationId: input.organizationId, provider: PROVIDER } },
    create: {
      publicId: createPublicId("int"),
      organizationId: input.organizationId,
      provider: PROVIDER,
      label: input.label ?? "ER:LC Server",
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      status: "DISCONNECTED",
      metadata: { webhookConfigured: Boolean(payload.webhookSecret) },
    },
    update: {
      label: input.label ?? "ER:LC Server",
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      metadata: { webhookConfigured: Boolean(payload.webhookSecret) },
    },
  });

  await checkErlcHealth(input.organizationId);
  return getErlcIntegration(input.organizationId);
}

export async function disconnectErlc(organizationId: string): Promise<void> {
  await prisma.integrationCredential.deleteMany({
    where: { organizationId, provider: PROVIDER },
  });
}

/** Ping ER:LC and persist the resulting health onto the credential row. */
export async function checkErlcHealth(organizationId: string): Promise<ErlcHealthResult> {
  const { client } = await getErlcClientForOrganization(organizationId);
  const health = await client.ping();
  const status = healthToStatus(health.status);

  await prisma.integrationCredential.updateMany({
    where: { organizationId, provider: PROVIDER },
    data: {
      status,
      lastCheckedAt: health.checkedAt,
      ...(health.status === "connected" ? { lastSuccessAt: health.checkedAt } : {}),
      lastError: health.status === "connected" ? null : health.message,
    },
  });

  return health;
}

export async function getErlcIntegration(
  organizationId: string,
): Promise<ErlcIntegrationSummary> {
  const mode = resolveErlcMode(process.env.ERLC_MODE);
  const credential = await prisma.integrationCredential.findUnique({
    where: { organizationId_provider: { organizationId, provider: PROVIDER } },
  });

  if (!credential) {
    return {
      connected: false,
      provider: "erlc",
      mode,
      status: "DISCONNECTED",
      label: null,
      hasCredentials: false,
      webhookConfigured: false,
      lastCheckedAt: null,
      lastSuccessAt: null,
      lastError: null,
    };
  }

  const metadata = (credential.metadata ?? {}) as { webhookConfigured?: boolean };
  const status = credential.status as IntegrationStatusValue;
  return {
    connected: status === "CONNECTED" || status === "DEGRADED",
    provider: "erlc",
    mode,
    status,
    label: credential.label,
    hasCredentials: true,
    webhookConfigured: Boolean(metadata.webhookConfigured),
    lastCheckedAt: credential.lastCheckedAt,
    lastSuccessAt: credential.lastSuccessAt,
    lastError: credential.lastError,
  };
}

/**
 * CAD synchronization: pull ER:LC emergency (911) calls and upsert them as CAD
 * entries. Returns the number of calls synchronized.
 */
export async function syncCadFromErlc(organizationId: string): Promise<{ synced: number }> {
  const { client } = await getErlcClientForOrganization(organizationId);
  const calls = await client.getCallLogs();
  let synced = 0;

  for (const call of calls) {
    const status = call.status === "active" ? "ACTIVE" : call.status === "closed" ? "CLOSED" : "PENDING";
    await prisma.cadCall.upsert({
      where: {
        organizationId_source_externalId: {
          organizationId,
          source: "erlc",
          externalId: call.id,
        },
      },
      create: {
        publicId: createPublicId("cad"),
        organizationId,
        source: "erlc",
        externalId: call.id,
        number: call.number,
        caller: call.caller,
        callerId: call.callerId !== null ? String(call.callerId) : null,
        message: call.message,
        location: call.location,
        status,
        openedAt: call.at,
        ...(status === "CLOSED" ? { closedAt: new Date() } : {}),
      },
      update: {
        status,
        message: call.message,
        location: call.location,
        ...(status === "CLOSED" ? { closedAt: new Date() } : {}),
      },
    });
    synced += 1;
  }

  return { synced };
}

/**
 * Player-history correlation: roll up currently-online players into
 * `ErlcPlayerSession` rows and link them to Roblox identities when known.
 */
export async function correlatePlayerHistory(
  organizationId: string,
): Promise<{ tracked: number; correlated: number }> {
  const { client } = await getErlcClientForOrganization(organizationId);
  const players = await client.getPlayers();
  let correlated = 0;

  for (const player of players) {
    const robloxUserId = String(player.id);
    const identity = await prisma.robloxIdentity.findUnique({ where: { robloxUserId } });
    if (identity) correlated += 1;

    await prisma.erlcPlayerSession.upsert({
      where: { organizationId_robloxUserId: { organizationId, robloxUserId } },
      create: {
        publicId: createPublicId("ply"),
        organizationId,
        robloxUserId,
        robloxUsername: player.name,
        callsign: player.callsign,
        team: player.team,
        lastWantedStars: player.wantedStars,
        robloxIdentityId: identity?.id ?? null,
      },
      update: {
        robloxUsername: player.name,
        callsign: player.callsign,
        team: player.team,
        lastWantedStars: player.wantedStars,
        lastSeenAt: new Date(),
        sessionCount: { increment: 1 },
        robloxIdentityId: identity?.id ?? null,
      },
    });
  }

  return { tracked: players.length, correlated };
}

/**
 * Verify and record an inbound ER:LC/CAD emergency-call webhook. The signature
 * is validated against the org's stored webhook secret before any write.
 */
export async function recordErlcCallWebhook(input: {
  organizationId: string;
  rawBody: string;
  signature: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const secret = await loadSecret(input.organizationId);
  if (!secret?.webhookSecret) {
    return { ok: false, reason: "webhook not configured" };
  }
  const valid = verifyErlcWebhook({
    rawBody: input.rawBody,
    signature: input.signature,
    secret: secret.webhookSecret,
  });
  if (!valid) {
    return { ok: false, reason: "invalid signature" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody);
  } catch {
    return { ok: false, reason: "invalid payload" };
  }

  const call = parseCallWebhook(payload, new Date());
  if (!call) {
    return { ok: false, reason: "unrecognized event" };
  }

  const status = call.status === "active" ? "ACTIVE" : call.status === "closed" ? "CLOSED" : "PENDING";
  await prisma.cadCall.upsert({
    where: {
      organizationId_source_externalId: {
        organizationId: input.organizationId,
        source: "erlc",
        externalId: call.id,
      },
    },
    create: {
      publicId: createPublicId("cad"),
      organizationId: input.organizationId,
      source: "erlc",
      externalId: call.id,
      number: call.number,
      caller: call.caller,
      callerId: call.callerId !== null ? String(call.callerId) : null,
      message: call.message,
      location: call.location,
      status,
      openedAt: call.at,
    },
    update: { status, message: call.message, location: call.location },
  });

  return { ok: true };
}

export type CadCallView = {
  id: string;
  number: string;
  caller: string;
  message: string;
  location: string | null;
  status: string;
  openedAt: Date;
};

export async function listCadCalls(
  organizationId: string,
  limit = 50,
): Promise<CadCallView[]> {
  const calls = await prisma.cadCall.findMany({
    where: { organizationId },
    orderBy: { openedAt: "desc" },
    take: limit,
  });
  return calls.map((call) => ({
    id: call.publicId,
    number: call.number,
    caller: call.caller,
    message: call.message,
    location: call.location,
    status: call.status,
    openedAt: call.openedAt,
  }));
}

export type PlayerHistoryView = {
  id: string;
  robloxUsername: string;
  robloxUserId: string;
  callsign: string | null;
  team: string | null;
  sessionCount: number;
  lastSeenAt: Date;
  linkedToRoblox: boolean;
};

export async function listPlayerHistory(
  organizationId: string,
  limit = 100,
): Promise<PlayerHistoryView[]> {
  const rows = await prisma.erlcPlayerSession.findMany({
    where: { organizationId },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.publicId,
    robloxUsername: row.robloxUsername,
    robloxUserId: row.robloxUserId,
    callsign: row.callsign,
    team: row.team,
    sessionCount: row.sessionCount,
    lastSeenAt: row.lastSeenAt,
    linkedToRoblox: row.robloxIdentityId !== null,
  }));
}
