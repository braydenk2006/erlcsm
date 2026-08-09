import { createHash } from "node:crypto";
import { decryptSecret, encryptSecret, prisma } from "@commandry/database";
import { createPublicId } from "@commandry/shared";

const PROVIDER = "discord";
const DISCORD_API = "https://discord.com/api/v10";

export type DiscordErrorCode =
  "RATE_LIMITED" | "FORBIDDEN" | "NOT_FOUND" | "OUTAGE" | "BAD_RESPONSE";

export class DiscordError extends Error {
  code: DiscordErrorCode;
  retryAfterMs?: number;
  constructor(message: string, code: DiscordErrorCode, retryAfterMs?: number) {
    super(message);
    this.name = "DiscordError";
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export type DiscordScheduledEventInput = {
  name: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
};

export interface DiscordClient {
  mode: "live" | "mock";
  guildId: string | null;
  hasCredentials: boolean;
  postAnnouncement(channelId: string, content: string): Promise<{ messageId: string }>;
  createScheduledEvent(input: DiscordScheduledEventInput): Promise<{ eventId: string }>;
  updateScheduledEvent(eventId: string, input: Partial<DiscordScheduledEventInput>): Promise<void>;
  cancelScheduledEvent(eventId: string): Promise<void>;
}

type DiscordSecret = { botToken: string; guildId: string };

async function loadDiscordSecret(organizationId: string): Promise<DiscordSecret | null> {
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
    return JSON.parse(raw) as DiscordSecret;
  } catch {
    return null;
  }
}

/** Deterministic-ish mock client for dev/test. Failure flags simulate outages. */
export function createMockDiscordClient(
  options: { guildId?: string; failMessage?: boolean; failEvent?: boolean } = {},
): DiscordClient {
  const id = (prefix: string, seed: string) =>
    `mock-${prefix}-${createHash("sha1")
      .update(seed + Date.now() + Math.random())
      .digest("hex")
      .slice(0, 16)}`;
  return {
    mode: "mock",
    guildId: options.guildId ?? "mock-guild",
    hasCredentials: true,
    async postAnnouncement(channelId, content) {
      if (options.failMessage) throw new DiscordError("Mock message failure", "OUTAGE");
      return { messageId: id("msg", channelId + content) };
    },
    async createScheduledEvent(input) {
      if (options.failEvent) throw new DiscordError("Mock event failure", "OUTAGE");
      return { eventId: id("evt", input.name + input.startsAt.toISOString()) };
    },
    async updateScheduledEvent() {
      if (options.failEvent) throw new DiscordError("Mock event failure", "OUTAGE");
    },
    async cancelScheduledEvent() {
      /* mock no-op */
    },
  };
}

/** Real Discord bot client (REST). Not exercised in environments without a bot. */
export function createLiveDiscordClient(secret: DiscordSecret): DiscordClient {
  const headers = { Authorization: `Bot ${secret.botToken}`, "Content-Type": "application/json" };

  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${DISCORD_API}${path}`, {
        ...init,
        headers: { ...headers, ...(init?.headers ?? {}) },
      });
    } catch {
      throw new DiscordError("Unable to reach Discord", "OUTAGE");
    }
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after"));
      throw new DiscordError(
        "Discord rate limited",
        "RATE_LIMITED",
        Number.isFinite(retry) ? retry * 1000 : undefined,
      );
    }
    if (res.status === 403) throw new DiscordError("Bot lacks permission", "FORBIDDEN");
    if (res.status === 404) throw new DiscordError("Discord resource not found", "NOT_FOUND");
    if (res.status >= 500) throw new DiscordError("Discord unavailable", "OUTAGE");
    if (!res.ok) throw new DiscordError(`Discord request failed (${res.status})`, "BAD_RESPONSE");
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    mode: "live",
    guildId: secret.guildId,
    hasCredentials: true,
    async postAnnouncement(channelId, content) {
      const data = await req<{ id: string }>(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      return { messageId: data.id };
    },
    async createScheduledEvent(input) {
      const data = await req<{ id: string }>(`/guilds/${secret.guildId}/scheduled-events`, {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          scheduled_start_time: input.startsAt.toISOString(),
          scheduled_end_time: input.endsAt.toISOString(),
          privacy_level: 2,
          entity_type: 3,
          entity_metadata: { location: input.location.slice(0, 100) },
        }),
      });
      return { eventId: data.id };
    },
    async updateScheduledEvent(eventId, input) {
      await req(`/guilds/${secret.guildId}/scheduled-events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(input.name ? { name: input.name } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.startsAt ? { scheduled_start_time: input.startsAt.toISOString() } : {}),
          ...(input.endsAt ? { scheduled_end_time: input.endsAt.toISOString() } : {}),
        }),
      });
    },
    async cancelScheduledEvent(eventId) {
      // status 4 = Cancelled
      await req(`/guilds/${secret.guildId}/scheduled-events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: 4 }),
      });
    },
  };
}

/**
 * Resolve the Discord client for an org. Uses the live bot when
 * `DISCORD_MODE=live` and credentials exist; otherwise a mock adapter so the
 * scheduled-shift flow works without a live guild (clearly labeled).
 */
export async function getDiscordClientForOrganization(
  organizationId: string,
): Promise<DiscordClient> {
  const secret = await loadDiscordSecret(organizationId);
  if (process.env.DISCORD_MODE === "live" && secret?.botToken && secret?.guildId) {
    return createLiveDiscordClient(secret);
  }
  return createMockDiscordClient({ guildId: secret?.guildId });
}

export async function connectDiscord(input: {
  organizationId: string;
  botToken: string;
  guildId: string;
  label?: string;
}): Promise<void> {
  const encrypted = encryptSecret(
    JSON.stringify({ botToken: input.botToken.trim(), guildId: input.guildId.trim() }),
  );
  await prisma.integrationCredential.upsert({
    where: {
      organizationId_provider: { organizationId: input.organizationId, provider: PROVIDER },
    },
    create: {
      publicId: createPublicId("int"),
      organizationId: input.organizationId,
      provider: PROVIDER,
      label: input.label ?? "Discord",
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      status: "CONNECTED",
    },
    update: { ciphertext: encrypted.ciphertext, iv: encrypted.iv, authTag: encrypted.authTag },
  });
}

export type DiscordIntegrationSummary = {
  connected: boolean;
  mode: "live" | "mock";
  guildId: string | null;
};

export async function getDiscordIntegration(
  organizationId: string,
): Promise<DiscordIntegrationSummary> {
  const secret = await loadDiscordSecret(organizationId);
  const live = process.env.DISCORD_MODE === "live" && Boolean(secret?.botToken);
  return {
    connected: Boolean(secret),
    mode: live ? "live" : "mock",
    guildId: secret?.guildId ?? null,
  };
}
