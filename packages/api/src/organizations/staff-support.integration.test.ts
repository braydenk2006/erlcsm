import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import type { Actor } from "@commandry/permissions";
import { buildActorForUser, createOrganization } from "./service";
import {
  getActiveSupportSession,
  getStaffOverview,
  requirePlatformStaff,
  revokeSupportSession,
  startSupportSession,
} from "../staff/service";
import {
  createTicket,
  getTicket,
  staffGetTicket,
  staffListTickets,
  staffReply,
} from "../support/service";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("staff panel + support (isolation)", () => {
  let orgId = "";
  let ownerActor: Actor;
  let ownerUserId = "";
  let supportStaffId = "";
  let adminStaffId = "";

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Cust Owner",
        email: `ss-owner-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    ownerUserId = owner.id;
    const org = await createOrganization({
      userId: owner.id,
      data: { name: "SS Co", slug: `ss-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
    ownerActor = await buildActorForUser(owner.id, orgId);
    const support = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Support Agent",
        email: `ss-sup-${Date.now()}@ex.com`,
        emailVerified: true,
        platformRole: "SUPPORT",
      },
    });
    supportStaffId = support.id;
    const admin = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Platform Admin",
        email: `ss-adm-${Date.now()}@ex.com`,
        emailVerified: true,
        platformRole: "ADMIN",
      },
    });
    adminStaffId = admin.id;
  });

  it("enforces platform-staff isolation from the authoritative DB role (org owners get nothing)", async () => {
    // The customer org OWNER (platformRole NONE) must be denied staff access.
    await expect(requirePlatformStaff(ownerUserId)).rejects.toThrow();
    await expect(getStaffOverview({ staffUserId: ownerUserId })).rejects.toThrow();
    await expect(staffListTickets({ staffUserId: ownerUserId })).rejects.toThrow();
    // Actual platform staff are allowed.
    expect((await requirePlatformStaff(supportStaffId)).role).toBe("SUPPORT");
    expect((await requirePlatformStaff(adminStaffId)).role).toBe("ADMIN");
    // The gate reads the DB, not any client-supplied value — even the min-tier is enforced server-side.
    await expect(requirePlatformStaff(supportStaffId, "ADMIN")).rejects.toThrow(); // support < admin
  });

  it("controls support sessions: read-only default, elevated gated, expiry, audit, revoke", async () => {
    const session = await startSupportSession({
      staffUserId: supportStaffId,
      organizationId: orgId,
      reason: "Ticket #1 diagnose",
      scope: "DIAGNOSE_INTEGRATIONS",
    });
    expect(session.mode).toBe("read_only"); // default
    expect(session.active).toBe(true);
    expect(new Date(session.endsAt).getTime()).toBeGreaterThan(Date.now());
    // Elevated (write) requires ADMIN+ — a SUPPORT agent cannot escalate scope.
    await expect(
      startSupportSession({
        staffUserId: supportStaffId,
        organizationId: orgId,
        reason: "write please",
        scope: "DIAGNOSE_FEATURE",
        mode: "elevated",
      }),
    ).rejects.toThrow();
    // Audited to PLATFORM_SUPPORT.
    expect(
      await prisma.auditEvent.count({
        where: {
          organizationId: orgId,
          source: "PLATFORM_SUPPORT",
          action: "support.session.start",
        },
      }),
    ).toBeGreaterThanOrEqual(1);
    // Active session is discoverable, then revocable.
    expect(
      await getActiveSupportSession({ staffUserId: supportStaffId, organizationId: orgId }),
    ).not.toBeNull();
    await revokeSupportSession({ staffUserId: supportStaffId, id: session.id });
    expect(
      await getActiveSupportSession({ staffUserId: supportStaffId, organizationId: orgId }),
    ).toBeNull();
    // A non-staff user cannot start a session.
    await expect(
      startSupportSession({
        staffUserId: ownerUserId,
        organizationId: orgId,
        reason: "nope",
        scope: "VIEW_CONFIGURATION",
      }),
    ).rejects.toThrow();
  });

  it("keeps internal staff notes invisible to customers", async () => {
    const ticket = await createTicket({
      actor: ownerActor,
      organizationId: orgId,
      subject: "Discord role not syncing",
      category: "discord",
      body: "Roles aren't updating.",
    });
    await staffReply({
      staffUserId: supportStaffId,
      id: ticket.id,
      body: "Checking your bot permissions.",
      internal: false,
    });
    await staffReply({
      staffUserId: supportStaffId,
      id: ticket.id,
      body: "INTERNAL: their bot lacks Manage Roles.",
      internal: true,
    });
    // Customer view excludes the internal note.
    const customerView = await getTicket({
      actor: ownerActor,
      organizationId: orgId,
      id: ticket.id,
    });
    expect(customerView.messages.some((m) => m.body.includes("INTERNAL"))).toBe(false);
    expect(
      customerView.messages.some((m) => m.body.includes("Checking your bot permissions")),
    ).toBe(true);
    // Staff view includes it.
    const staffView = await staffGetTicket({ staffUserId: supportStaffId, id: ticket.id });
    expect(staffView.messages.some((m) => m.internal && m.body.includes("INTERNAL"))).toBe(true);
  });

  it("isolates tenants — a customer cannot read another org's ticket", async () => {
    const other = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Other Owner",
        email: `ss-o-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const otherOrg = await createOrganization({
      userId: other.id,
      data: { name: "Other SS", slug: `ss-o-${Date.now()}`, timezone: "UTC" },
    });
    const otherActor = await buildActorForUser(other.id, otherOrg.id);
    const ticket = await createTicket({
      actor: ownerActor,
      organizationId: orgId,
      subject: "Private",
      category: "general",
      body: "secret",
    });
    // Wrong org + wrong requester → not found (no cross-tenant read).
    await expect(
      getTicket({ actor: otherActor, organizationId: otherOrg.id, id: ticket.id }),
    ).rejects.toThrow();
  });
});
