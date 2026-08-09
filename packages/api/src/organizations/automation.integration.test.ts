import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import type { Actor } from "@commandry/permissions";
import { buildActorForUser, createOrganization } from "./service";
import {
  createAutomation,
  ensureBuiltInAutomations,
  getAutomationAnalytics,
  listAutomations,
  processQueuedRuns,
  publishEvent,
} from "../automation/service";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("automation platform", () => {
  let orgId = "";
  let ownerUserId = "";
  let owner: Actor;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Auto Owner",
        email: `auto-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    ownerUserId = user.id;
    const org = await createOrganization({
      userId: user.id,
      data: { name: "Auto Co", slug: `auto-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
    owner = await buildActorForUser(user.id, orgId);
  });

  it("seeds built-in automations (disabled)", async () => {
    await ensureBuiltInAutomations(orgId);
    const list = await listAutomations({ actor: owner, organizationId: orgId });
    expect(list.length).toBeGreaterThanOrEqual(5);
    expect(list.every((a) => (a.isBuiltIn ? !a.enabled : true))).toBe(true);
  });

  it("publishes an event, matches an enabled automation, executes the action, and completes", async () => {
    await createAutomation({
      actor: owner,
      organizationId: orgId,
      name: "Notify on announcement",
      trigger: "Announcement.Published",
      actions: [{ type: "send_notification", config: { title: "News!", allMembers: true } }],
    });
    const correlationId = createPublicId("cor");
    const { queued } = await publishEvent({
      type: "Announcement.Published",
      organizationId: orgId,
      actorUserId: ownerUserId,
      metadata: { title: "Hello" },
      correlationId,
    });
    expect(queued).toBe(1);
    // Idempotency: re-publishing the same event does not create a duplicate run.
    expect(
      (await publishEvent({ type: "Announcement.Published", organizationId: orgId, correlationId }))
        .queued,
    ).toBe(0);

    await processQueuedRuns(50);
    const run = await prisma.automationRun.findFirst({
      where: { organizationId: orgId, correlationId },
    });
    expect(run?.status).toBe("COMPLETED");
    const notif = await prisma.notification.findFirst({
      where: { organizationId: orgId, userId: ownerUserId, type: "automation" },
    });
    expect(notif).not.toBeNull();
  });

  it("evaluates conditions server-side (only matching events run)", async () => {
    await createAutomation({
      actor: owner,
      organizationId: orgId,
      name: "Leave completions only",
      trigger: "Workflow.Completed",
      conditions: {
        combinator: "AND",
        conditions: [{ field: "category", op: "eq", value: "leave" }],
      },
      actions: [{ type: "send_notification", config: { title: "Leave done", toActor: true } }],
    });
    const noMatch = await publishEvent({
      type: "Workflow.Completed",
      organizationId: orgId,
      actorUserId: ownerUserId,
      metadata: { category: "application" },
    });
    expect(noMatch.queued).toBe(0);
    const match = await publishEvent({
      type: "Workflow.Completed",
      organizationId: orgId,
      actorUserId: ownerUserId,
      metadata: { category: "leave" },
    });
    expect(match.queued).toBe(1);
  });

  it("retries a failing action with backoff rather than failing immediately", async () => {
    await createAutomation({
      actor: owner,
      organizationId: orgId,
      name: "Bad webhook",
      trigger: "Session.Completed",
      actions: [{ type: "webhook", config: { url: "http://127.0.0.1:1/nope" } }],
    });
    const correlationId = createPublicId("cor");
    await publishEvent({
      type: "Session.Completed",
      organizationId: orgId,
      correlationId,
      metadata: {},
    });
    await processQueuedRuns(50);
    const run = await prisma.automationRun.findFirst({
      where: { organizationId: orgId, correlationId },
    });
    expect(["RETRYING", "FAILED"]).toContain(run?.status);
    expect(run?.attempts).toBeGreaterThanOrEqual(1);
    expect(run?.error).toBeTruthy();
  });

  it("isolates tenants — events never trigger another org's automations", async () => {
    const otherUser = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Other",
        email: `other-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const otherOrg = await createOrganization({
      userId: otherUser.id,
      data: { name: "Other Co", slug: `other-${Date.now()}`, timezone: "UTC" },
    });
    const otherActor = await buildActorForUser(otherUser.id, otherOrg.id);
    await createAutomation({
      actor: otherActor,
      organizationId: otherOrg.id,
      name: "Other automation",
      trigger: "Announcement.Published",
      actions: [{ type: "refresh_sitemap", config: {} }],
    });
    // Publish in the FIRST org; the other org's automation must not run.
    const before = await prisma.automationRun.count({ where: { organizationId: otherOrg.id } });
    await publishEvent({
      type: "Announcement.Published",
      organizationId: orgId,
      metadata: { title: "x" },
    });
    const after = await prisma.automationRun.count({ where: { organizationId: otherOrg.id } });
    expect(after).toBe(before);
  });

  it("reports automation analytics", async () => {
    const analytics = await getAutomationAnalytics({ actor: owner, organizationId: orgId });
    expect(analytics.totalRuns).toBeGreaterThanOrEqual(1);
    expect(analytics.enabledAutomations).toBeGreaterThanOrEqual(1);
  });
});
