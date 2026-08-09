import { beforeAll, describe, expect, it } from "vitest";
import { createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import type { Actor } from "@commandry/permissions";
import { buildActorForUser, createOrganization } from "./service";
import { completeScheduledShift } from "../operations/scheduling";
import { adjustLoggedMinutes } from "../operations/presence-tracking";
import { getMemberParticipation } from "../operations/participation";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("verified logged minutes from private-server presence", () => {
  let orgId = "";
  let actor: Actor;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Verified Owner",
        email: `vf-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    const org = await createOrganization({
      userId: user.id,
      data: { name: "Verified Co", slug: `vf-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
    actor = await buildActorForUser(user.id, orgId);
  });

  async function activeShift(eligibleTeams: string[] = []) {
    const base = new Date(Date.now() - 120 * 60_000);
    return prisma.scheduledShift.create({
      data: {
        publicId: createPublicId("sch"),
        organizationId: orgId,
        title: "Verified Patrol",
        scheduledStart: base,
        scheduledEnd: new Date(),
        status: "ACTIVE",
        actualStart: base,
        hostMembershipId: actor.membershipId,
        erlcServer: "Main",
        eligibleTeams,
        createdByUserId: actor.userId,
      },
    });
  }

  async function addInterval(
    shiftId: string,
    base: Date,
    startMin: number,
    endMin: number,
    team: string,
    eligible: boolean,
  ) {
    const start = new Date(base.getTime() + startMin * 60_000);
    const end = new Date(base.getTime() + endMin * 60_000);
    await prisma.presenceInterval.create({
      data: {
        organizationId: orgId,
        scheduledShiftId: shiftId,
        membershipId: actor.membershipId,
        userId: actor.userId,
        robloxUserId: "999001",
        firstSeenAt: start,
        lastSeenAt: end,
        intervalStart: start,
        intervalEnd: end,
        durationSeconds: (endMin - startMin) * 60,
        team,
        eligible,
        open: false,
        reconciliationStatus: "CLOSED",
      },
    });
  }

  it("logs verified presence (86), not the 120-minute scheduled duration, and credits exactly once", async () => {
    const shift = await activeShift();
    // Present 18:08-18:47 (39) + 18:55-19:42 (47) = 86 within the 2h window.
    await addInterval(shift.id, shift.scheduledStart, 8, 47, "Police", true);
    await addInterval(shift.id, shift.scheduledStart, 55, 102, "Police", true);

    await completeScheduledShift({ actor, organizationId: orgId, id: shift.id });

    const logged = await prisma.shiftLoggedMinutes.findUniqueOrThrow({
      where: {
        scheduledShiftId_membershipId: {
          scheduledShiftId: shift.id,
          membershipId: actor.membershipId,
        },
      },
    });
    expect(logged.automaticMinutes).toBe(86);
    expect(logged.finalMinutes).toBe(86);
    expect(logged.automaticMinutes).not.toBe(120); // not the scheduled duration

    const events = await prisma.participationEvent.findMany({
      where: {
        organizationId: orgId,
        membershipId: actor.membershipId,
        sourceType: "scheduled_shift",
        sourceId: shift.id,
        type: "SHIFT_COMPLETED",
      },
    });
    expect(events).toHaveLength(1); // exactly once
    expect(events[0]!.durationMinutes).toBe(86);
  });

  it("excludes ineligible-team presence from logged minutes", async () => {
    const shift = await activeShift(["Police"]);
    await addInterval(shift.id, shift.scheduledStart, 10, 100, "Civilian", false); // ineligible team
    await completeScheduledShift({ actor, organizationId: orgId, id: shift.id });
    const logged = await prisma.shiftLoggedMinutes.findUnique({
      where: {
        scheduledShiftId_membershipId: {
          scheduledShiftId: shift.id,
          membershipId: actor.membershipId,
        },
      },
    });
    // No eligible interval -> no logged-minutes row and no credit.
    expect(logged).toBeNull();
    const events = await prisma.participationEvent.count({
      where: { sourceType: "scheduled_shift", sourceId: shift.id, type: "SHIFT_COMPLETED" },
    });
    expect(events).toBe(0);
  });

  it("applies a manual adjustment as a delta without overwriting the automatic calculation", async () => {
    const shift = await activeShift();
    await addInterval(shift.id, shift.scheduledStart, 8, 47, "Police", true);
    await addInterval(shift.id, shift.scheduledStart, 55, 102, "Police", true);
    await completeScheduledShift({ actor, organizationId: orgId, id: shift.id });

    const before = (
      await getMemberParticipation({ organizationId: orgId, membershipId: actor.membershipId })
    ).metrics.totalActiveMinutes;
    await adjustLoggedMinutes({
      actor,
      organizationId: orgId,
      shiftId: shift.id,
      membershipId: actor.membershipId,
      finalMinutes: 96,
      reason: "Missed reconnect",
    });

    const logged = await prisma.shiftLoggedMinutes.findUniqueOrThrow({
      where: {
        scheduledShiftId_membershipId: {
          scheduledShiftId: shift.id,
          membershipId: actor.membershipId,
        },
      },
    });
    expect(logged.automaticMinutes).toBe(86); // original preserved
    expect(logged.adjustmentMinutes).toBe(10);
    expect(logged.finalMinutes).toBe(96);
    const after = (
      await getMemberParticipation({ organizationId: orgId, membershipId: actor.membershipId })
    ).metrics.totalActiveMinutes;
    expect(after).toBe(before + 10); // +10 delta credited to activity, not a re-credit of 96
  });
});
