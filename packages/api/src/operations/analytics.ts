import { prisma } from "@commandry/database";
import { computeMetrics, type ParticipationEventType } from "@commandry/operations";
import { authorize, type Actor } from "@commandry/permissions";
import { ForbiddenError } from "@commandry/shared";

export type OrgAnalytics = {
  periodDays: number;
  totalActiveMinutes: number;
  completedShifts: number;
  sessionsAttended: number;
  hostedSessions: number;
  activeMembers: number;
  leaderboard: { userId: string; name: string; activeMinutes: number }[];
};

/**
 * Organization operational analytics — aggregated directly from the shared
 * participation ledger. Sessions/shifts/activity do NOT keep their own analytics.
 */
export async function getOrgAnalytics(input: {
  actor: Actor;
  organizationId: string;
  periodDays?: number;
}): Promise<OrgAnalytics> {
  const decision = authorize({
    actor: input.actor,
    organizationId: input.organizationId,
    action: "activity:read",
  });
  if (!decision.allowed) throw new ForbiddenError(decision.reason);

  const periodDays = input.periodDays ?? 7;
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const events = await prisma.participationEvent.findMany({
    where: { organizationId: input.organizationId, occurredAt: { gte: since } },
    select: { type: true, durationMinutes: true, metadata: true, userId: true },
  });

  const metrics = computeMetrics(
    events.map((e) => ({
      type: e.type as ParticipationEventType,
      durationMinutes: e.durationMinutes,
      metadata: e.metadata as Record<string, unknown>,
    })),
  );

  const byUser = new Map<string, number>();
  for (const e of events) {
    if (
      (e.type === "SHIFT_COMPLETED" ||
        e.type === "SESSION_ATTENDED" ||
        e.type === "MANUAL_ADJUSTMENT") &&
      typeof e.durationMinutes === "number"
    ) {
      byUser.set(e.userId, (byUser.get(e.userId) ?? 0) + e.durationMinutes);
    }
  }
  const topUserIds = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const users = await prisma.user.findMany({
    where: { id: { in: topUserIds.map(([id]) => id) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return {
    periodDays,
    totalActiveMinutes: metrics.totalActiveMinutes,
    completedShifts: metrics.completedShifts,
    sessionsAttended: metrics.sessionsAttended,
    hostedSessions: metrics.hostedSessions,
    activeMembers: byUser.size,
    leaderboard: topUserIds.map(([userId, activeMinutes]) => ({
      userId,
      name: nameById.get(userId) ?? "Member",
      activeMinutes,
    })),
  };
}
