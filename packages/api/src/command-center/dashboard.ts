import {
  PALETTE_DESTINATIONS,
  QUICK_ACTIONS,
  buildExecutiveSummary,
  computeHealth,
  filterActions,
  normalizeLayout,
  trendFrom,
  visibleWidgets,
  type HealthInputs,
  type QuickAction,
  type SummaryLine,
  type WidgetDef,
  type WidgetLayoutItem,
} from "@commandry/command-center";
import { prisma } from "@commandry/database";
import { getErlcClientForOrganization } from "@commandry/integrations";
import { authorize, isAction, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError } from "@commandry/shared";
import { getOrganizationManifest } from "../subscriptions/service";
import { listNotifications, unreadNotificationCount } from "../notifications/service";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type DashboardPayload = {
  organizationId: string;
  generatedAt: string;
  widgets: { key: string; title: string; category: string; defaultSize: string }[];
  layout: WidgetLayoutItem[];
  quickActions: QuickAction[];
  paletteDestinations: QuickAction[];
  executiveSummary: SummaryLine[];
  data: Record<string, unknown>;
};

/**
 * The single Dashboard aggregation API. One permission-checked, tenant-isolated
 * call returns every widget's data plus the deterministic Community Health score
 * and the personalized layout — so widgets never independently query dozens of
 * endpoints.
 */
export async function getDashboard(input: {
  actor: Actor;
  organizationId: string;
}): Promise<DashboardPayload> {
  const { actor, organizationId: org } = input;
  if (!authorize({ actor, organizationId: org, action: "organization:read" }).allowed) {
    throw new ForbiddenError("Not permitted");
  }

  const manifest = await getOrganizationManifest(org);
  const hasFeature = (f: string) => (manifest.features as Record<string, boolean>)[f] === true;
  const canDo = (p: string) =>
    isAction(p) ? authorize({ actor, organizationId: org, action: p as Action }).allowed : false;

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  const d7 = new Date(now.getTime() - 7 * 86_400_000);
  const d7day = dayKey(d7);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const soon = new Date(now.getTime() + 60 * 60_000);

  const [
    activeMembers,
    newMembers30d,
    trainingAssigned,
    trainingCompleted,
    trainingCompletedRecent,
    pendingApplications,
    applicationsToday,
    inReviewTotal,
    revisionRequested,
    assignedToMe,
    completedToday,
    automationRuns,
    departments,
    upcomingShiftsRaw,
    shiftsStartingSoon,
    completedShifts30d,
    missedShifts30d,
    activeMemberIds,
    websiteVisits7d,
    eventFeedRaw,
    notifications,
    unread,
    priorSnapshot,
  ] = await Promise.all([
    prisma.membership.count({ where: { organizationId: org, status: "ACTIVE" } }),
    prisma.membership.count({
      where: { organizationId: org, status: "ACTIVE", joinedAt: { gte: d30 } },
    }),
    prisma.workflowSubmission.count({
      where: { organizationId: org, template: { category: "training" }, status: { not: "DRAFT" } },
    }),
    prisma.workflowSubmission.count({
      where: { organizationId: org, template: { category: "training" }, status: "COMPLETED" },
    }),
    prisma.workflowSubmission.count({
      where: {
        organizationId: org,
        template: { category: "training" },
        status: "COMPLETED",
        completedAt: { gte: d7 },
      },
    }),
    prisma.workflowSubmission.count({
      where: { organizationId: org, template: { category: "application" }, status: "IN_REVIEW" },
    }),
    prisma.workflowSubmission.count({
      where: {
        organizationId: org,
        template: { category: "application" },
        submittedAt: { gte: startOfDay },
      },
    }),
    prisma.workflowSubmission.count({ where: { organizationId: org, status: "IN_REVIEW" } }),
    prisma.workflowSubmission.count({
      where: { organizationId: org, status: "REVISION_REQUESTED" },
    }),
    prisma.workflowAssignment.count({
      where: { organizationId: org, assigneeUserId: actor.userId, decision: null },
    }),
    prisma.workflowSubmission.count({
      where: { organizationId: org, status: "COMPLETED", completedAt: { gte: startOfDay } },
    }),
    prisma.automationRun.findMany({
      where: { organizationId: org },
      select: { status: true, startedAt: true, finishedAt: true, createdAt: true },
    }),
    prisma.department.findMany({
      where: { organizationId: org, isActive: true },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
    prisma.scheduledShift.findMany({
      where: {
        organizationId: org,
        scheduledStart: { gte: now },
        status: { notIn: ["CANCELLED", "COMPLETED", "MISSED"] },
      },
      orderBy: { scheduledStart: "asc" },
      take: 6,
      select: {
        id: true,
        publicId: true,
        title: true,
        scheduledStart: true,
        status: true,
        shiftType: true,
        hostMembershipId: true,
      },
    }),
    prisma.scheduledShift.count({
      where: {
        organizationId: org,
        scheduledStart: { gte: now, lte: soon },
        status: { notIn: ["CANCELLED", "COMPLETED", "MISSED"] },
      },
    }),
    prisma.scheduledShift.count({
      where: { organizationId: org, status: "COMPLETED", scheduledStart: { gte: d30 } },
    }),
    prisma.scheduledShift.count({
      where: { organizationId: org, status: "MISSED", scheduledStart: { gte: d30 } },
    }),
    prisma.participationEvent.findMany({
      where: { organizationId: org, occurredAt: { gte: d30 } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.websiteVisit.aggregate({
      where: { organizationId: org, day: { gte: d7day } },
      _sum: { count: true },
    }),
    prisma.automationEventLog.findMany({
      where: { organizationId: org },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { type: true, createdAt: true, actorUserId: true, metadata: true },
    }),
    listNotifications({ organizationId: org, userId: actor.userId, limit: 8 }),
    unreadNotificationCount({ organizationId: org, userId: actor.userId }),
    prisma.healthSnapshot.findFirst({
      where: { organizationId: org, day: { lt: dayKey(now) } },
      orderBy: { day: "desc" },
    }),
  ]);

  // Live server (best-effort — outages must not break the dashboard).
  let liveServer: {
    online: boolean;
    currentPlayers: number;
    maxPlayers: number;
    queue: number;
  } | null;
  try {
    const { client } = await getErlcClientForOrganization(org);
    const status = await client.getServerStatus();
    const queue =
      (status as { queueCount?: number; queue?: number }).queueCount ??
      (status as { queue?: number }).queue ??
      0;
    liveServer = {
      online: status.connected,
      currentPlayers: status.currentPlayers,
      maxPlayers: status.maxPlayers,
      queue,
    };
  } catch {
    liveServer = null;
  }

  const completed = automationRuns.filter((r) => r.status === "COMPLETED");
  const failed = automationRuns.filter((r) => r.status === "FAILED").length;
  const retrying = automationRuns.filter((r) => r.status === "RETRYING").length;
  const queued = automationRuns.filter((r) => r.status === "QUEUED").length;
  const runsToday = automationRuns.filter((r) => r.createdAt >= startOfDay).length;
  const doneRuns = completed.length + failed;
  const automationSuccessRate = doneRuns > 0 ? completed.length / doneRuns : 1;
  const avgDurationMs =
    completed.length > 0
      ? Math.round(
          completed.reduce(
            (s, r) => s + ((r.finishedAt?.getTime() ?? 0) - (r.startedAt?.getTime() ?? 0)),
            0,
          ) / completed.length,
        )
      : 0;

  const membersMax = manifest.getLimit("members.max");
  const targetMembers = membersMax >= 1_000_000_000 ? Math.max(activeMembers, 25) : membersMax;
  const understaffedDepartments = departments.filter((dp) => dp._count.members < 3).length;
  const attendanceRate =
    completedShifts30d + missedShifts30d > 0
      ? completedShifts30d / (completedShifts30d + missedShifts30d)
      : 1;
  const activityComplianceRate =
    activeMembers > 0 ? Math.min(1, activeMemberIds.length / activeMembers) : 1;

  const healthInputs: HealthInputs = {
    activeMembers,
    newMembers30d,
    targetMembers,
    trainingCompleted,
    trainingAssigned,
    attendanceRate,
    activityComplianceRate,
    automationSuccessRate,
    automationRuns: automationRuns.length,
    websiteViews7d: websiteVisits7d._sum.count ?? 0,
    serverOnline: liveServer?.online ?? false,
    pendingApprovals: inReviewTotal,
    outstandingWorkflows: revisionRequested,
    departments: departments.length,
    understaffedDepartments,
  };
  const health = computeHealth(healthInputs);

  // Deterministic trend from yesterday's stored score; persist today's.
  const priorFactors = (priorSnapshot?.factors as Record<string, number> | undefined) ?? undefined;
  health.trend = trendFrom(health.overall, priorSnapshot?.overall ?? null);
  health.factors = health.factors.map((f) => ({
    ...f,
    trend: trendFrom(f.score, priorFactors?.[f.key] ?? null),
  }));
  await prisma.healthSnapshot
    .upsert({
      where: { organizationId_day: { organizationId: org, day: dayKey(now) } },
      create: {
        organizationId: org,
        day: dayKey(now),
        overall: health.overall,
        factors: Object.fromEntries(health.factors.map((f) => [f.key, f.score])),
      },
      update: {
        overall: health.overall,
        factors: Object.fromEntries(health.factors.map((f) => [f.key, f.score])),
      },
    })
    .catch(() => undefined);

  const executiveSummary = buildExecutiveSummary({
    pendingApplications,
    assignedToMe,
    outstandingWorkflows: revisionRequested,
    shiftsStartingSoon,
    trainingOverdue: Math.max(0, trainingAssigned - trainingCompleted),
    automationFailures: failed,
    automationSuccessRate,
    serverOnline: liveServer?.online ?? false,
    healthSeverity: health.severity,
    understaffedDepartments,
  });

  const available: WidgetDef[] = visibleWidgets(hasFeature, canDo);
  const savedPref = await prisma.dashboardPreference.findUnique({
    where: { organizationId_userId: { organizationId: org, userId: actor.userId } },
  });
  const layout = normalizeLayout(
    (savedPref?.layout as WidgetLayoutItem[] | null) ?? null,
    available,
  );

  const data: Record<string, unknown> = {
    community_health: health,
    executive_summary: executiveSummary,
    quick_actions: filterActions(QUICK_ACTIONS, hasFeature, canDo),
    notifications: { items: notifications, unread },
    live_server: liveServer,
    upcoming_operations: upcomingShiftsRaw.map((s) => ({
      id: s.id,
      publicId: s.publicId,
      title: s.title,
      start: s.scheduledStart.toISOString(),
      status: s.status,
      shiftType: s.shiftType,
      hasHost: Boolean(s.hostMembershipId),
    })),
    pending_applications: {
      total: pendingApplications,
      assignedToMe,
      todaySubmissions: applicationsToday,
    },
    training_progress: {
      completed: trainingCompleted,
      assigned: trainingAssigned,
      pct: trainingAssigned > 0 ? Math.round((trainingCompleted / trainingAssigned) * 100) : 100,
      recentCompletions: trainingCompletedRecent,
    },
    workflow_queue: {
      pending: inReviewTotal,
      revisions: revisionRequested,
      assignedToMe,
      completedToday,
    },
    automation_health: {
      executedToday: runsToday,
      successRate: automationSuccessRate,
      failed,
      retrying,
      queued,
      avgDurationMs,
      total: automationRuns.length,
    },
    website_activity: { viewsLast7d: websiteVisits7d._sum.count ?? 0 },
    department_status: departments.map((dp) => ({
      id: dp.id,
      name: dp.name,
      staffCount: dp._count.members,
      understaffed: dp._count.members < 3,
    })),
    event_feed: eventFeedRaw.map((e) => ({
      type: e.type,
      at: e.createdAt.toISOString(),
      metadata: e.metadata,
    })),
  };

  return {
    organizationId: org,
    generatedAt: now.toISOString(),
    widgets: available.map((w) => ({
      key: w.key,
      title: w.title,
      category: w.category,
      defaultSize: w.defaultSize,
    })),
    layout,
    quickActions: filterActions(QUICK_ACTIONS, hasFeature, canDo),
    paletteDestinations: filterActions(PALETTE_DESTINATIONS, hasFeature, canDo),
    executiveSummary,
    data,
  };
}

// ---------------------------------------------------------------------------
// Personalization
// ---------------------------------------------------------------------------

export async function saveDashboardLayout(input: {
  actor: Actor;
  organizationId: string;
  layout: WidgetLayoutItem[];
}): Promise<void> {
  if (
    !authorize({
      actor: input.actor,
      organizationId: input.organizationId,
      action: "organization:read",
    }).allowed
  ) {
    throw new ForbiddenError("Not permitted");
  }
  await prisma.dashboardPreference.upsert({
    where: {
      organizationId_userId: { organizationId: input.organizationId, userId: input.actor.userId },
    },
    create: {
      organizationId: input.organizationId,
      userId: input.actor.userId,
      layout: input.layout as unknown as object,
    },
    update: { layout: input.layout as unknown as object },
  });
}

export async function resetDashboardLayout(input: {
  actor: Actor;
  organizationId: string;
}): Promise<void> {
  await prisma.dashboardPreference
    .delete({
      where: {
        organizationId_userId: { organizationId: input.organizationId, userId: input.actor.userId },
      },
    })
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Command palette search (permission-aware, tenant-isolated)
// ---------------------------------------------------------------------------

/** Cheap (no heavy queries) palette navigation + quick actions, filtered for the actor. */
export async function getPaletteContext(input: {
  actor: Actor;
  organizationId: string;
}): Promise<{ destinations: QuickAction[]; quickActions: QuickAction[] }> {
  const { actor, organizationId: org } = input;
  if (!authorize({ actor, organizationId: org, action: "organization:read" }).allowed)
    throw new ForbiddenError("Not permitted");
  const manifest = await getOrganizationManifest(org);
  const hasFeature = (f: string) => (manifest.features as Record<string, boolean>)[f] === true;
  const canDo = (p: string) =>
    isAction(p) ? authorize({ actor, organizationId: org, action: p as Action }).allowed : false;
  return {
    destinations: filterActions(PALETTE_DESTINATIONS, hasFeature, canDo),
    quickActions: filterActions(QUICK_ACTIONS, hasFeature, canDo),
  };
}

export type PaletteResult = { kind: string; label: string; sublabel?: string; href: string };

export async function searchCommandPalette(input: {
  actor: Actor;
  organizationId: string;
  query: string;
}): Promise<PaletteResult[]> {
  const { actor, organizationId: org } = input;
  if (!authorize({ actor, organizationId: org, action: "organization:read" }).allowed)
    throw new ForbiddenError("Not permitted");
  const q = input.query.trim();
  if (q.length < 2) return [];
  const canDo = (p: string) =>
    isAction(p) ? authorize({ actor, organizationId: org, action: p as Action }).allowed : false;
  const results: PaletteResult[] = [];

  if (canDo("member:read")) {
    const members = await prisma.membership.findMany({
      where: {
        organizationId: org,
        status: "ACTIVE",
        user: { name: { contains: q, mode: "insensitive" } },
      },
      select: { user: { select: { name: true } }, publicId: true },
      take: 5,
    });
    for (const m of members)
      results.push({ kind: "Member", label: m.user.name, href: "/app/staff" });
  }
  if (canDo("department:read")) {
    const depts = await prisma.department.findMany({
      where: { organizationId: org, name: { contains: q, mode: "insensitive" } },
      select: { name: true },
      take: 5,
    });
    for (const d of depts)
      results.push({ kind: "Department", label: d.name, href: "/app/departments" });
  }
  if (canDo("announcement:read")) {
    const anns = await prisma.announcement.findMany({
      where: { organizationId: org, title: { contains: q, mode: "insensitive" } },
      select: { title: true },
      take: 5,
    });
    for (const a of anns)
      results.push({ kind: "Announcement", label: a.title, href: "/app/announcements" });
  }
  if (canDo("automation.view")) {
    const autos = await prisma.automation.findMany({
      where: { organizationId: org, name: { contains: q, mode: "insensitive" } },
      select: { name: true },
      take: 5,
    });
    for (const a of autos)
      results.push({ kind: "Automation", label: a.name, href: "/app/automations" });
  }
  return results.slice(0, 20);
}
