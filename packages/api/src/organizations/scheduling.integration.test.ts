import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId, ValidationError } from "@commandry/shared";
import { prisma } from "@commandry/database";
import { getErlcClientForOrganization } from "@commandry/integrations";
import type { Actor } from "@commandry/permissions";
import { buildActorForUser, createOrganization } from "./service";
import {
  claimShift,
  completeScheduledShift,
  createScheduledShift,
  getSchedulingAnalytics,
  markShiftAttendance,
  openClaiming,
  publishShift,
  startScheduledShift,
  syncShiftPrcPresence,
} from "../operations/scheduling";
import { getMemberParticipation } from "../operations/participation";

const hasDb = Boolean(process.env.DATABASE_URL);

async function addMember(organizationId: string, name: string, roleKey: string) {
  const user = await prisma.user.create({
    data: {
      publicId: createPublicId("usr"),
      name,
      email: `${name}-${Date.now()}@ex.com`,
      emailVerified: true,
    },
  });
  const membership = await prisma.membership.create({
    data: { publicId: createPublicId("mem"), organizationId, userId: user.id, status: "ACTIVE" },
  });
  const role = await prisma.role.findFirst({ where: { organizationId, key: roleKey } });
  if (role)
    await prisma.membershipRole.create({ data: { membershipId: membership.id, roleId: role.id } });
  return { userId: user.id, membershipId: membership.id };
}

describe.skipIf(!hasDb)("scheduled shift workflow", () => {
  let orgId = "";
  let actor: Actor;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Sched Owner",
        email: `sched-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const org = await createOrganization({
      userId: user.id,
      data: { name: "Sched Co", slug: `sc-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
    actor = await buildActorForUser(user.id, orgId);
  });

  async function newShift(overrides: Record<string, unknown> = {}) {
    return createScheduledShift({
      actor,
      organizationId: orgId,
      title: "Evening Patrol",
      scheduledStart: new Date(Date.now() + 3600_000),
      scheduledEnd: new Date(Date.now() + 3 * 3600_000),
      erlcServer: "Main",
      ...overrides,
    });
  }

  it("runs owner→open→claim→publish→start→attendance→complete and credits the shared ledger", async () => {
    const shift = await newShift();
    expect(shift.status).toBe("DRAFT");
    await openClaiming({ actor, organizationId: orgId, id: shift.id });
    const claim = await claimShift({ actor, organizationId: orgId, id: shift.id });
    expect(claim.status).toBe("CLAIMED");

    const pub = await publishShift({ actor, organizationId: orgId, id: shift.id });
    expect(pub.discordState).toBe("PUBLISHED");
    const afterPublish = await prisma.scheduledShift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(afterPublish.discordEventId).toBeTruthy();

    // Idempotent publish: retry must not create a second Discord event.
    await publishShift({ actor, organizationId: orgId, id: shift.id });
    const afterRetry = await prisma.scheduledShift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(afterRetry.discordEventId).toBe(afterPublish.discordEventId);

    await startScheduledShift({ actor, organizationId: orgId, id: shift.id, override: true });
    await markShiftAttendance({
      actor,
      organizationId: orgId,
      id: shift.id,
      membershipId: actor.membershipId,
      status: "PRESENT",
      minutes: 90,
    });

    const before = (
      await getMemberParticipation({ organizationId: orgId, membershipId: actor.membershipId })
    ).metrics.completedShifts;
    await completeScheduledShift({
      actor,
      organizationId: orgId,
      id: shift.id,
      notes: "Clean patrol",
    });
    const after = (
      await getMemberParticipation({ organizationId: orgId, membershipId: actor.membershipId })
    ).metrics.completedShifts;
    expect(after).toBe(before + 1);

    const analytics = await getSchedulingAnalytics({ actor, organizationId: orgId });
    expect(analytics.scheduled).toBeGreaterThanOrEqual(1);
    expect(analytics.completed).toBeGreaterThanOrEqual(1);
  });

  it("enforces single-host claiming (no double claim)", async () => {
    const shift = await newShift();
    await openClaiming({ actor, organizationId: orgId, id: shift.id });
    const staff = await addMember(orgId, "Claimer", "staff");
    const staffActor = await buildActorForUser(staff.userId, orgId);
    const first = await claimShift({ actor: staffActor, organizationId: orgId, id: shift.id });
    expect(first.status).toBe("CLAIMED");
    // Owner tries to claim the now-taken shift.
    await expect(claimShift({ actor, organizationId: orgId, id: shift.id })).rejects.toBeInstanceOf(
      ValidationError,
    );
    const reloaded = await prisma.scheduledShift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(reloaded.hostMembershipId).toBe(staff.membershipId);
  });

  it("PRC correlation: links only identified players, suggests by default, and manual takes precedence", async () => {
    // Link the owner to a real simulator player so correlation finds them.
    const { client } = await getErlcClientForOrganization(orgId);
    const players = await client.getPlayers();
    const player = players[0]!;
    await prisma.robloxIdentity.upsert({
      where: { userId: actor.userId },
      create: {
        publicId: createPublicId("rbx"),
        userId: actor.userId,
        robloxUserId: String(player.id),
        username: player.name,
        verifiedAt: new Date(),
      },
      update: { robloxUserId: String(player.id) },
    });

    const shift = await newShift({ prcSyncPolicy: "AUTO_PRESENT" });
    await openClaiming({ actor, organizationId: orgId, id: shift.id });
    await claimShift({ actor, organizationId: orgId, id: shift.id });
    await startScheduledShift({ actor, organizationId: orgId, id: shift.id, override: true });

    const first = await syncShiftPrcPresence({ organizationId: orgId, id: shift.id });
    expect(first.matched).toBeGreaterThanOrEqual(1); // owner detected via linked identity
    // First pass has ~0 presence minutes -> below threshold -> not applied yet.
    // Age the match so the second sync accrues enough presence.
    await prisma.prcPresenceMatch.updateMany({
      where: { scheduledShiftId: shift.id },
      data: { lastSeenAt: new Date(Date.now() - 30 * 60_000) },
    });
    const second = await syncShiftPrcPresence({ organizationId: orgId, id: shift.id });
    expect(second.applied).toBeGreaterThanOrEqual(1);
    const auto = await prisma.attendanceRecord.findUnique({
      where: {
        contextType_contextId_membershipId: {
          contextType: "scheduled_shift",
          contextId: shift.id,
          membershipId: actor.membershipId,
        },
      },
    });
    expect(auto?.status).toBe("PRESENT");
    expect(auto?.recordedByUserId).toBeNull(); // applied by automation, not a human
  });
});
