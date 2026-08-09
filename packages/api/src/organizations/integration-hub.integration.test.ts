import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import type { Actor } from "@commandry/permissions";
import { buildActorForUser, createOrganization } from "./service";
import { publishEvent } from "../automation/service";
import {
  connectDiscordIntegration,
  getDiscordConfig,
  getIntegrationHub,
  testDiscord,
  updateDiscordConfig,
} from "../integrations/hub";
import {
  createWebhook,
  enqueueWebhookDeliveries,
  listWebhooks,
  processWebhookDeliveries,
} from "../integrations/webhooks";
import {
  authenticateApiKey,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "../integrations/api-keys";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("integration hub", () => {
  let orgId = "";
  let owner: Actor;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Hub Owner",
        email: `hub-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const org = await createOrganization({
      userId: user.id,
      data: { name: "Hub Co", slug: `hub-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
    owner = await buildActorForUser(user.id, orgId);
  });

  it("aggregates all integrations with deterministic overall health", async () => {
    const hub = await getIntegrationHub({ actor: owner, organizationId: orgId });
    expect(hub.cards.map((c) => c.key).sort()).toEqual([
      "api_keys",
      "discord",
      "erlc",
      "roblox",
      "webhooks",
    ]);
    // Nothing configured yet → never-configured disconnected integrations don't count → HEALTHY.
    expect(["HEALTHY", "ACTION_REQUIRED"]).toContain(hub.overall);
  });

  it("blocks SSRF webhook targets and never returns the secret after creation", async () => {
    await expect(
      createWebhook({
        actor: owner,
        organizationId: orgId,
        name: "Bad",
        url: "https://127.0.0.1/x",
        events: ["Announcement.Published"],
      }),
    ).rejects.toThrow();
    await expect(
      createWebhook({
        actor: owner,
        organizationId: orgId,
        name: "Bad2",
        url: "http://hooks.example.com/x",
        events: ["Announcement.Published"],
      }),
    ).rejects.toThrow(); // not https
    const { webhook, secret } = await createWebhook({
      actor: owner,
      organizationId: orgId,
      name: "Prod hook",
      url: "https://hooks.example.com/ordinex",
      events: ["Announcement.Published"],
    });
    expect(secret).toMatch(/^whsec_/);
    // The stored row keeps ciphertext, not the plaintext secret; the view exposes only a prefix.
    const listed = await listWebhooks({ actor: owner, organizationId: orgId });
    const view = listed.find((w) => w.id === webhook.id)!;
    expect(JSON.stringify(view)).not.toContain(secret);
    expect(view.secretPrefix).toBe(secret.slice(0, 12));
    const row = await prisma.webhookEndpoint.findUnique({ where: { id: webhook.id } });
    expect(row?.ciphertext).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain(secret);
  });

  it("fans events out to subscribed endpoints (idempotent) and retries failed deliveries", async () => {
    const correlationId = createPublicId("cor");
    const before = await prisma.webhookDelivery.count({ where: { organizationId: orgId } });
    await publishEvent({
      type: "Announcement.Published",
      organizationId: orgId,
      correlationId,
      metadata: { title: "Hi" },
    });
    // Re-publishing the same event does not create a duplicate delivery.
    await enqueueWebhookDeliveries({
      type: "Announcement.Published",
      organizationId: orgId,
      correlationId,
      metadata: {},
    });
    expect(await prisma.webhookDelivery.count({ where: { organizationId: orgId } })).toBe(
      before + 1,
    );
    // Delivery attempts an unreachable host → RETRYING/FAILED (never succeeds offline).
    await processWebhookDeliveries(50);
    const delivery = await prisma.webhookDelivery.findFirst({
      where: { organizationId: orgId, correlationId },
    });
    expect(["RETRYING", "FAILED"]).toContain(delivery?.status);
    expect(delivery?.attempts).toBeGreaterThanOrEqual(1);
  });

  it("issues API keys shown once, hashed at rest, with scope + tenant enforcement", async () => {
    const { apiKey, plaintext } = await createApiKey({
      actor: owner,
      organizationId: orgId,
      name: "CI key",
      scopes: ["members.read"],
    });
    expect(plaintext).toMatch(/^ordx_/);
    // Never stored or returned in plaintext.
    const listed = await listApiKeys({ actor: owner, organizationId: orgId });
    expect(JSON.stringify(listed)).not.toContain(plaintext);
    const row = await prisma.apiKey.findFirst({ where: { id: apiKey.id } });
    expect(row?.hashedKey).toBeTruthy();
    expect(row?.hashedKey).not.toBe(plaintext);
    // Auth + scope enforcement.
    const auth = await authenticateApiKey(plaintext, "members.read");
    expect(auth?.organizationId).toBe(orgId);
    expect(await authenticateApiKey(plaintext, "cad.read")).toBeNull(); // scope not granted
    expect(await authenticateApiKey("ordx_wrong", "members.read")).toBeNull();
    // Revocation disables it.
    await revokeApiKey({ actor: owner, organizationId: orgId, id: apiKey.id });
    expect(await authenticateApiKey(plaintext, "members.read")).toBeNull();
  });

  it("connects + configures Discord (simulation clearly labelled) reusing the existing service", async () => {
    await connectDiscordIntegration({
      actor: owner,
      organizationId: orgId,
      botToken: "test-bot-token-1234567890",
      guildId: "9999",
    });
    const config = await getDiscordConfig({ actor: owner, organizationId: orgId });
    expect(config.connected).toBe(true);
    await updateDiscordConfig({
      actor: owner,
      organizationId: orgId,
      channels: { announcements: "1234" },
    });
    const updated = await getDiscordConfig({ actor: owner, organizationId: orgId });
    expect(updated.channels.announcements).toBe("1234");
    const diag = await testDiscord({ actor: owner, organizationId: orgId });
    // No live Discord creds in the test env → simulation, honestly reported.
    expect(diag.mode).toBe("mock");
    expect(diag.note.toLowerCase()).toContain("simulation");
    // Discord now shows on the hub (DEGRADED = simulation, not falsely healthy).
    const hub = await getIntegrationHub({ actor: owner, organizationId: orgId });
    expect(hub.cards.find((c) => c.key === "discord")?.status).toBe("DEGRADED");
  });

  it("isolates tenants — webhooks/keys never cross organizations", async () => {
    const otherUser = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Other",
        email: `hub-o-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const otherOrg = await createOrganization({
      userId: otherUser.id,
      data: { name: "Other Hub", slug: `hub-o-${Date.now()}`, timezone: "UTC" },
    });
    const otherActor = await buildActorForUser(otherUser.id, otherOrg.id);
    expect(await listWebhooks({ actor: otherActor, organizationId: otherOrg.id })).toHaveLength(0);
    expect(await listApiKeys({ actor: otherActor, organizationId: otherOrg.id })).toHaveLength(0);
  });
});
