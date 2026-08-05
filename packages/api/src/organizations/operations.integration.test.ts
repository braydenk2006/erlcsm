import { beforeAll, describe, expect, it } from "vitest";
import { ConflictError, createPublicId } from "@commandry/shared";
import { prisma } from "@commandry/database";
import type { Actor } from "@commandry/permissions";
import { buildActorForUser, createOrganization } from "./service";
import {
  endShift,
  getActiveShift,
  startBreak,
  startShift,
  autoCloseStaleShifts,
} from "../operations/shifts";
import { createSession, markSessionAttendance, transitionSession } from "../operations/sessions";
import { getMemberParticipation } from "../operations/participation";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("operational time platform", () => {
  let userId = "";
  let orgId = "";
  let membershipId = "";
  let actor: Actor;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: createPublicId("usr"),
        name: "Op Owner",
        email: `op-${Date.now()}@ex.com`,
        emailVerified: true,
      },
    });
    userId = user.id;
    const org = await createOrganization({
      userId,
      data: { name: "Ops Co", slug: `ops-${Date.now()}`, timezone: "UTC" },
    });
    orgId = org.id;
    actor = await buildActorForUser(userId, orgId);
    membershipId = actor.membershipId;
  });

  it("runs a shift lifecycle and derives activity from the ledger", async () => {
    const shift = await startShift({ actor, organizationId: orgId });
    expect(shift.status).toBe("ACTIVE");
    // Prevent overlapping shifts.
    await expect(startShift({ actor, organizationId: orgId })).rejects.toBeInstanceOf(
      ConflictError,
    );
    // Backdate the start so active time is measurable.
    await prisma.shift.update({
      where: { id: shift.id },
      data: { startedAt: new Date(Date.now() - 120 * 60_000) },
    });
    await startBreak({ actor, organizationId: orgId });
    // Manually credit a 10-minute break window.
    await prisma.shift.update({
      where: { id: shift.id },
      data: { currentBreakStartedAt: new Date(Date.now() - 10 * 60_000) },
    });
    const ended = await endShift({ actor, organizationId: orgId });
    expect(ended.status).toBe("COMPLETED");
    expect(ended.activeMinutes).toBeGreaterThanOrEqual(100);
    expect(await getActiveShift({ actor, organizationId: orgId })).toBeNull();

    const participation = await getMemberParticipation({ organizationId: orgId, membershipId });
    expect(participation.metrics.completedShifts).toBe(1);
    expect(participation.metrics.shiftMinutes).toBe(ended.activeMinutes);
    expect(participation.metrics.totalActiveMinutes).toBe(ended.activeMinutes);
    expect(participation.timeline.some((t) => t.type === "SHIFT_COMPLETED")).toBe(true);
  });

  it("credits session attendance into the same activity ledger", async () => {
    const session = await createSession({ actor, organizationId: orgId, title: "Training" });
    await transitionSession({ actor, organizationId: orgId, sessionId: session.id, to: "OPEN" });
    await transitionSession({ actor, organizationId: orgId, sessionId: session.id, to: "ACTIVE" });
    await markSessionAttendance({
      actor,
      organizationId: orgId,
      sessionId: session.id,
      membershipId,
      status: "PRESENT",
      minutes: 45,
    });
    const before = (await getMemberParticipation({ organizationId: orgId, membershipId })).metrics;
    await transitionSession({
      actor,
      organizationId: orgId,
      sessionId: session.id,
      to: "COMPLETED",
    });
    const after = (await getMemberParticipation({ organizationId: orgId, membershipId })).metrics;
    expect(after.sessionsAttended).toBe(before.sessionsAttended + 1);
    expect(after.sessionMinutes).toBe(before.sessionMinutes + 45);
    expect(after.hostedSessions).toBe(before.hostedSessions + 1);
  });

  it("auto-closes stale shifts past the max duration", async () => {
    const shift = await startShift({ actor, organizationId: orgId });
    await prisma.shift.update({
      where: { id: shift.id },
      data: { startedAt: new Date(Date.now() - 48 * 60 * 60_000) }, // 48h ago
    });
    const closed = await autoCloseStaleShifts();
    expect(closed).toBeGreaterThanOrEqual(1);
    const reloaded = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(reloaded?.status).toBe("COMPLETED");
  });
});
