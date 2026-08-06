import { prisma } from "@commandry/database";
import { getErlcClientForOrganization } from "@commandry/integrations";
import { authorize, type Actor } from "@commandry/permissions";
import { ForbiddenError } from "@commandry/shared";

/**
 * Command Center aggregation service — a clean, read-only API that collects a
 * snapshot from every subsystem for future dashboards. Backend foundation only;
 * the full dashboard UI is a follow-up. Tenant-isolated.
 */
export type CommandCenterSnapshot = {
  server: { online: boolean; currentPlayers: number; maxPlayers: number } | null;
  pendingApplications: number;
  workflowQueue: number;
  upcomingShifts: number;
  recentAnnouncements: number;
  trainingCompleted: number;
  websiteViews: number;
  automationHealth: { total: number; completed: number; failed: number; successRate: number };
  cadActiveCalls: number;
  unreadNotifications: number;
  communityHealthScore: number;
};

export async function getCommandCenter(input: {
  actor: Actor;
  organizationId: string;
}): Promise<CommandCenterSnapshot> {
  if (
    !authorize({
      actor: input.actor,
      organizationId: input.organizationId,
      action: "organization:read",
    }).allowed
  ) {
    throw new ForbiddenError("Not permitted");
  }
  const org = input.organizationId;
  const now = new Date();

  const [
    pendingApplications,
    workflowQueue,
    upcomingShifts,
    recentAnnouncements,
    trainingCompleted,
    websiteViews,
    runs,
    cadActiveCalls,
    unreadNotifications,
    activeMembers,
  ] = await Promise.all([
    prisma.workflowSubmission.count({
      where: { organizationId: org, status: "IN_REVIEW", template: { category: "application" } },
    }),
    prisma.workflowSubmission.count({ where: { organizationId: org, status: "IN_REVIEW" } }),
    prisma.scheduledShift.count({
      where: {
        organizationId: org,
        scheduledStart: { gte: now },
        status: { notIn: ["CANCELLED", "COMPLETED", "MISSED"] },
      },
    }),
    prisma.announcement.count({ where: { organizationId: org, status: "PUBLISHED" } }),
    prisma.workflowSubmission.count({
      where: { organizationId: org, status: "COMPLETED", template: { category: "training" } },
    }),
    prisma.websiteVisit.aggregate({ where: { organizationId: org }, _sum: { count: true } }),
    prisma.automationRun.findMany({ where: { organizationId: org }, select: { status: true } }),
    prisma.cadCall.count({ where: { organizationId: org, status: "ACTIVE" } }),
    prisma.notification.count({
      where: { organizationId: org, userId: input.actor.userId, readAt: null },
    }),
    prisma.membership.count({ where: { organizationId: org, status: "ACTIVE" } }),
  ]);

  let server: CommandCenterSnapshot["server"];
  try {
    const { client } = await getErlcClientForOrganization(org);
    const status = await client.getServerStatus();
    server = {
      online: status.connected,
      currentPlayers: status.currentPlayers,
      maxPlayers: status.maxPlayers,
    };
  } catch {
    server = null;
  }

  const completed = runs.filter((r) => r.status === "COMPLETED").length;
  const failed = runs.filter((r) => r.status === "FAILED").length;
  const doneRuns = completed + failed;
  const automationHealth = {
    total: runs.length,
    completed,
    failed,
    successRate: doneRuns > 0 ? completed / doneRuns : 1,
  };

  // Composite 0-100 health score (simple, transparent weighting).
  let score = 50;
  if (server?.online) score += 15;
  if (activeMembers > 0) score += 10;
  if (recentAnnouncements > 0) score += 5;
  if (upcomingShifts > 0) score += 10;
  score += Math.round(automationHealth.successRate * 10);
  score -= Math.min(20, pendingApplications); // backlog penalty
  const communityHealthScore = Math.max(0, Math.min(100, score));

  return {
    server,
    pendingApplications,
    workflowQueue,
    upcomingShifts,
    recentAnnouncements,
    trainingCompleted,
    websiteViews: websiteViews._sum.count ?? 0,
    automationHealth,
    cadActiveCalls,
    unreadNotifications,
    communityHealthScore,
  };
}
