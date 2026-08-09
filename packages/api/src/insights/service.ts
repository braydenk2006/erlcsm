import { computeHealth, type HealthInputs } from "@commandry/command-center";
import { prisma } from "@commandry/database";
import { getErlcClientForOrganization } from "@commandry/integrations";
import {
  KPI_DEFS,
  alertLevelForSeverity,
  buildInsights,
  canTransitionAlert,
  evaluateGoal,
  evaluateKpi,
  evaluateRecommendations,
  groupHealthFactors,
  recentDeclines,
  recentImprovements,
  shouldRaiseAlert,
  summarizeInsights,
  type AlertStatus,
  type Direction,
  type Insight,
  type KpiEvaluation,
  type Recommendation,
} from "@commandry/insights";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";
import { getOrganizationManifest } from "../subscriptions/service";

function requirePerm(actor: Actor, organizationId: string, action: Action): void {
  if (!authorize({ actor, organizationId, action }).allowed)
    throw new ForbiddenError("Not permitted");
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Raw metric aggregation (shared basis for KPIs + Community Health)
// ---------------------------------------------------------------------------

type RawMetrics = {
  activeMembers: number;
  newMembers30d: number;
  targetMembers: number;
  trainingCompleted: number;
  trainingAssigned: number;
  attendanceRate: number;
  activityComplianceRate: number;
  automationSuccessRate: number;
  automationRuns: number;
  automationFailures: number;
  websiteViews7d: number;
  serverOnline: boolean;
  pendingApprovals: number;
  applicationBacklog: number;
  avgReviewHours: number;
  outstandingWorkflows: number;
  departments: number;
  understaffedDepartments: number;
};

async function aggregateMetrics(org: string): Promise<RawMetrics> {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  const d7day = dayKey(new Date(now.getTime() - 7 * 86_400_000));

  const [
    activeMembers,
    newMembers30d,
    trainingAssigned,
    trainingCompleted,
    applicationBacklog,
    inReviewTotal,
    revisionRequested,
    runs,
    departments,
    completedShifts30d,
    missedShifts30d,
    activityMemberIds,
    websiteVisits7d,
    reviewed,
    manifest,
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
      where: { organizationId: org, template: { category: "application" }, status: "IN_REVIEW" },
    }),
    prisma.workflowSubmission.count({ where: { organizationId: org, status: "IN_REVIEW" } }),
    prisma.workflowSubmission.count({
      where: { organizationId: org, status: "REVISION_REQUESTED" },
    }),
    prisma.automationRun.findMany({ where: { organizationId: org }, select: { status: true } }),
    prisma.department.findMany({
      where: { organizationId: org, isActive: true },
      select: { _count: { select: { members: true } } },
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
    prisma.workflowSubmission.findMany({
      where: {
        organizationId: org,
        template: { category: "application" },
        status: "COMPLETED",
        submittedAt: { not: null },
        completedAt: { gte: d30 },
      },
      select: { submittedAt: true, completedAt: true },
    }),
    getOrganizationManifest(org),
  ]);

  const completed = runs.filter((r) => r.status === "COMPLETED").length;
  const failed = runs.filter((r) => r.status === "FAILED").length;
  const doneRuns = completed + failed;
  const understaffedDepartments = departments.filter((d) => d._count.members < 3).length;
  const membersMax = manifest.getLimit("members.max");
  const targetMembers = membersMax >= 1_000_000_000 ? Math.max(activeMembers, 25) : membersMax;

  const reviewHours = reviewed
    .filter((r) => r.submittedAt && r.completedAt)
    .map((r) => (r.completedAt!.getTime() - r.submittedAt!.getTime()) / 3_600_000);
  const avgReviewHours =
    reviewHours.length > 0 ? reviewHours.reduce((s, h) => s + h, 0) / reviewHours.length : 0;

  let serverOnline: boolean;
  try {
    const { client } = await getErlcClientForOrganization(org);
    serverOnline = (await client.getServerStatus()).connected;
  } catch {
    serverOnline = false;
  }

  return {
    activeMembers,
    newMembers30d,
    targetMembers,
    trainingCompleted,
    trainingAssigned,
    attendanceRate:
      completedShifts30d + missedShifts30d > 0
        ? completedShifts30d / (completedShifts30d + missedShifts30d)
        : 1,
    activityComplianceRate:
      activeMembers > 0 ? Math.min(1, activityMemberIds.length / activeMembers) : 1,
    automationSuccessRate: doneRuns > 0 ? completed / doneRuns : 1,
    automationRuns: runs.length,
    automationFailures: failed,
    websiteViews7d: websiteVisits7d._sum.count ?? 0,
    serverOnline,
    pendingApprovals: inReviewTotal,
    applicationBacklog,
    avgReviewHours,
    outstandingWorkflows: revisionRequested,
    departments: departments.length,
    understaffedDepartments,
  };
}

function healthInputsFrom(m: RawMetrics): HealthInputs {
  return {
    activeMembers: m.activeMembers,
    newMembers30d: m.newMembers30d,
    targetMembers: m.targetMembers,
    trainingCompleted: m.trainingCompleted,
    trainingAssigned: m.trainingAssigned,
    attendanceRate: m.attendanceRate,
    activityComplianceRate: m.activityComplianceRate,
    automationSuccessRate: m.automationSuccessRate,
    automationRuns: m.automationRuns,
    websiteViews7d: m.websiteViews7d,
    serverOnline: m.serverOnline,
    pendingApprovals: m.pendingApprovals,
    outstandingWorkflows: m.outstandingWorkflows,
    departments: m.departments,
    understaffedDepartments: m.understaffedDepartments,
  };
}

/** Current value per KPI key, with a human evidence string. */
function kpiValues(
  m: RawMetrics,
  healthOverall: number,
): Record<string, { value: number; evidence: string }> {
  return {
    attendance_rate: {
      value: m.attendanceRate,
      evidence: `Attendance across scheduled shifts in the last 30 days.`,
    },
    training_completion: {
      value: m.trainingAssigned > 0 ? m.trainingCompleted / m.trainingAssigned : 1,
      evidence: `${m.trainingCompleted}/${m.trainingAssigned} assigned trainings completed.`,
    },
    automation_success: {
      value: m.automationSuccessRate,
      evidence: `${m.automationRuns} automation runs, ${m.automationFailures} failed.`,
    },
    community_health: {
      value: healthOverall,
      evidence: `Weighted average of 11 community-health factors.`,
    },
    website_views_7d: {
      value: m.websiteViews7d,
      evidence: `Public website views in the last 7 days.`,
    },
    application_backlog: {
      value: m.applicationBacklog,
      evidence: `${m.applicationBacklog} applications awaiting review.`,
    },
    avg_review_hours: {
      value: Math.round(m.avgReviewHours * 10) / 10,
      evidence: `Average time from submission to decision (last 30 days).`,
    },
    active_members: {
      value: m.activeMembers,
      evidence: `${m.activeMembers} active members of ${m.targetMembers} target.`,
    },
    department_staffing: {
      value: m.departments > 0 ? (m.departments - m.understaffedDepartments) / m.departments : 1,
      evidence: `${m.understaffedDepartments}/${m.departments} departments understaffed.`,
    },
    automation_failures: {
      value: m.automationFailures,
      evidence: `${m.automationFailures} automation runs failed.`,
    },
    recruitment_30d: {
      value: m.newMembers30d,
      evidence: `${m.newMembers30d} members joined in the last 30 days.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Insights bundle (the intelligence layer the Command Center + future AI consume)
// ---------------------------------------------------------------------------

export type CommunityHealthExpanded = {
  overall: number;
  severity: string;
  trend: string;
  categories: ReturnType<typeof groupHealthFactors>;
  factors: ReturnType<typeof computeHealth>["factors"];
};

export type InsightsBundle = {
  generatedAt: string;
  kpis: KpiEvaluation[];
  insights: Insight[];
  recommendations: Recommendation[];
  improvements: Insight[];
  declines: Insight[];
  communityHealth: CommunityHealthExpanded;
  executiveSummary: { text: string; severity: string }[];
  alerts: AlertView[];
};

export type AlertView = {
  id: string;
  level: string;
  title: string;
  body: string | null;
  status: string;
  insightKey: string;
  createdAt: string;
};

/**
 * Compute the full deterministic intelligence bundle. Persists KPI/day snapshots
 * (for trend + projection), append-only insight records (timeline), and raises
 * alerts for warning/critical insights (idempotent per day). Tenant-isolated.
 */
export async function getInsightsBundle(input: {
  actor: Actor;
  organizationId: string;
}): Promise<InsightsBundle> {
  requirePerm(input.actor, input.organizationId, "insights.view");
  const org = input.organizationId;
  const now = new Date();
  const today = dayKey(now);

  const metrics = await aggregateMetrics(org);
  const health = computeHealth(healthInputsFrom(metrics));

  // Community-health trend from yesterday's stored score (Phase 8 HealthSnapshot).
  const priorHealth = await prisma.healthSnapshot.findFirst({
    where: { organizationId: org, day: { lt: today } },
    orderBy: { day: "desc" },
  });

  const values = kpiValues(metrics, health.overall);

  // Load prior KPI snapshots (most recent day < today) for trends.
  const priorSnaps = await prisma.kpiSnapshot.findMany({
    where: { organizationId: org, day: { lt: today } },
    orderBy: { day: "desc" },
  });
  const priorByKpi = new Map<string, number>();
  for (const s of priorSnaps) if (!priorByKpi.has(s.kpiKey)) priorByKpi.set(s.kpiKey, s.value);

  const kpis: KpiEvaluation[] = KPI_DEFS.map((def) => {
    const v = values[def.key];
    const current = v?.value ?? 0;
    const previous = priorByKpi.has(def.key) ? priorByKpi.get(def.key)! : null;
    return evaluateKpi(def, current, previous, v?.evidence ?? "");
  });

  // Persist today's KPI snapshots (idempotent per day).
  await Promise.all(
    kpis.map((k) =>
      prisma.kpiSnapshot
        .upsert({
          where: { organizationId_kpiKey_day: { organizationId: org, kpiKey: k.key, day: today } },
          create: { organizationId: org, kpiKey: k.key, day: today, value: k.current },
          update: { value: k.current },
        })
        .catch(() => undefined),
    ),
  );

  const insights = buildInsights(kpis);

  // Persist insight timeline (idempotent per key/day).
  await Promise.all(
    insights.map((i) =>
      prisma.insightRecord
        .upsert({
          where: { organizationId_key_day: { organizationId: org, key: i.key, day: today } },
          create: {
            publicId: createPublicId("ins"),
            organizationId: org,
            key: i.key,
            category: i.category,
            severity: i.severity,
            title: i.title,
            explanation: i.explanation,
            current: i.current,
            previous: i.previous,
            trend: i.trendType,
            recommendation: i.recommendation,
            evidence: i.evidence,
            day: today,
          },
          update: {
            severity: i.severity,
            title: i.title,
            explanation: i.explanation,
            current: i.current,
            previous: i.previous,
            trend: i.trendType,
            recommendation: i.recommendation,
          },
        })
        .catch(() => undefined),
    ),
  );

  // Raise alerts for warning/critical insights (idempotent per key/day).
  for (const i of insights.filter((x) => shouldRaiseAlert(x.severity))) {
    await prisma.alert
      .upsert({
        where: {
          organizationId_insightKey_day: { organizationId: org, insightKey: i.key, day: today },
        },
        create: {
          publicId: createPublicId("alr"),
          organizationId: org,
          insightKey: i.key,
          level: alertLevelForSeverity(i.severity),
          title: i.title,
          body: i.recommendation ?? i.explanation,
          day: today,
        },
        update: {
          level: alertLevelForSeverity(i.severity),
          title: i.title,
          body: i.recommendation ?? i.explanation,
        },
      })
      .catch(() => undefined);
  }

  const alerts = await prisma.alert.findMany({
    where: { organizationId: org, status: { in: ["open", "acknowledged", "escalated"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const categories = groupHealthFactors(
    health.factors.map((f) => ({
      key: f.key,
      label: f.label,
      score: f.score,
      weight: f.weight,
      target: f.target,
      trend: f.trend,
      explanation: f.explanation,
      recommendedAction: f.recommendedAction,
    })),
  );

  const recommendations = evaluateRecommendations(kpis);
  const executiveSummary = summarizeInsights(insights, {
    previous: priorHealth?.overall ?? null,
    current: health.overall,
  });

  return {
    generatedAt: now.toISOString(),
    kpis,
    insights,
    recommendations,
    improvements: recentImprovements(insights),
    declines: recentDeclines(insights),
    communityHealth: {
      overall: health.overall,
      severity: health.severity,
      trend: priorHealth
        ? health.overall > priorHealth.overall
          ? "improving"
          : health.overall < priorHealth.overall
            ? "declining"
            : "stable"
        : "insufficient_data",
      categories,
      factors: health.factors,
    },
    executiveSummary,
    alerts: alerts.map((a) => ({
      id: a.id,
      level: a.level,
      title: a.title,
      body: a.body,
      status: a.status,
      insightKey: a.insightKey,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export type GoalView = {
  id: string;
  name: string;
  metricKey: string;
  target: number;
  scope: string;
  departmentId: string | null;
  status: string;
  dueAt: string | null;
  current: number;
  progress: number;
  onTarget: boolean;
  trend: string;
  severity: string;
  estimatedDaysToTarget: number | null;
  recommendation: string;
};

export async function listGoals(input: {
  actor: Actor;
  organizationId: string;
}): Promise<GoalView[]> {
  requirePerm(input.actor, input.organizationId, "insights.view");
  const org = input.organizationId;
  const [goals, bundle] = await Promise.all([
    prisma.goal.findMany({
      where: { organizationId: org, status: { not: "archived" } },
      orderBy: { createdAt: "asc" },
    }),
    getInsightsBundle({ actor: input.actor, organizationId: org }),
  ]);
  const kpiByKey = new Map(bundle.kpis.map((k) => [k.key, k]));
  return goals.map((g) => {
    const kpi = kpiByKey.get(g.metricKey);
    const direction: Direction = kpi?.direction ?? "higher_better";
    const current = kpi?.current ?? 0;
    const evalResult = evaluateGoal(
      { metricKey: g.metricKey, target: g.target, direction, baseline: g.baseline },
      current,
      kpi?.previous ?? null,
    );
    return {
      id: g.id,
      name: g.name,
      metricKey: g.metricKey,
      target: g.target,
      scope: g.scope,
      departmentId: g.departmentId,
      status: g.status,
      dueAt: g.dueAt?.toISOString() ?? null,
      current,
      progress: evalResult.progress,
      onTarget: evalResult.onTarget,
      trend: evalResult.trend.type,
      severity: evalResult.severity,
      estimatedDaysToTarget: evalResult.estimatedDaysToTarget,
      recommendation: evalResult.recommendation,
    };
  });
}

export async function createGoal(input: {
  actor: Actor;
  organizationId: string;
  name: string;
  metricKey: string;
  target: number;
  scope?: string;
  departmentId?: string;
  dueAt?: Date;
  recurring?: boolean;
}): Promise<{ id: string }> {
  requirePerm(input.actor, input.organizationId, "goals.manage");
  if (!KPI_DEFS.some((k) => k.key === input.metricKey)) throw new ValidationError("Unknown metric");
  if (input.name.trim().length < 2) throw new ValidationError("Name too short");
  // Baseline = current value at creation (for progress).
  const bundle = await getInsightsBundle({
    actor: input.actor,
    organizationId: input.organizationId,
  });
  const baseline = bundle.kpis.find((k) => k.key === input.metricKey)?.current ?? null;
  const goal = await prisma.goal.create({
    data: {
      publicId: createPublicId("goal"),
      organizationId: input.organizationId,
      name: input.name.trim(),
      metricKey: input.metricKey,
      target: input.target,
      scope: input.scope ?? "organization",
      departmentId: input.departmentId ?? null,
      dueAt: input.dueAt ?? null,
      recurring: input.recurring ?? false,
      baseline,
      createdByUserId: input.actor.userId,
    },
  });
  return { id: goal.id };
}

export async function deleteGoal(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "goals.manage");
  const g = await prisma.goal.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!g) throw new NotFoundError("Goal not found");
  await prisma.goal.delete({ where: { id: g.id } });
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export async function updateAlertStatus(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  status: AlertStatus;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "alerts.manage");
  const alert = await prisma.alert.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!alert) throw new NotFoundError("Alert not found");
  if (!canTransitionAlert(alert.status as AlertStatus, input.status))
    throw new ValidationError(`Cannot move alert from ${alert.status} to ${input.status}`);
  await prisma.alert.update({
    where: { id: alert.id },
    data: {
      status: input.status,
      acknowledgedByUserId:
        input.status === "acknowledged" ? input.actor.userId : alert.acknowledgedByUserId,
    },
  });
}

export async function listAlerts(input: {
  actor: Actor;
  organizationId: string;
  status?: string;
}): Promise<AlertView[]> {
  requirePerm(input.actor, input.organizationId, "insights.view");
  const alerts = await prisma.alert.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return alerts.map((a) => ({
    id: a.id,
    level: a.level,
    title: a.title,
    body: a.body,
    status: a.status,
    insightKey: a.insightKey,
    createdAt: a.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Department insights + timeline
// ---------------------------------------------------------------------------

export type DepartmentInsights = {
  departmentId: string;
  name: string;
  staffCount: number;
  understaffed: boolean;
  leaders: number;
  insights: { severity: string; title: string; recommendation: string | null; evidence: string }[];
};

export async function getDepartmentInsights(input: {
  actor: Actor;
  organizationId: string;
  departmentId: string;
}): Promise<DepartmentInsights> {
  requirePerm(input.actor, input.organizationId, "department.insights");
  const dept = await prisma.department.findFirst({
    where: { id: input.departmentId, organizationId: input.organizationId },
    include: {
      _count: { select: { members: true } },
      members: { where: { isLeader: true }, select: { id: true } },
    },
  });
  if (!dept) throw new NotFoundError("Department not found");
  const staffCount = dept._count.members;
  const leaders = dept.members.length;
  const understaffed = staffCount < 3;
  const insights: DepartmentInsights["insights"] = [];
  if (understaffed) {
    insights.push({
      severity: staffCount === 0 ? "critical" : "warning",
      title: "Staffing below target",
      recommendation: "Assign members or recruit for this department.",
      evidence: `${staffCount} members (target 3+).`,
    });
  }
  if (leaders === 0) {
    insights.push({
      severity: "warning",
      title: "No department leader",
      recommendation: "Promote a member to lead this department.",
      evidence: "0 leaders assigned.",
    });
  }
  if (insights.length === 0) {
    insights.push({
      severity: "healthy",
      title: "Department healthy",
      recommendation: null,
      evidence: `${staffCount} members, ${leaders} leader(s).`,
    });
  }
  return { departmentId: dept.id, name: dept.name, staffCount, understaffed, leaders, insights };
}

export type TimelineEntry = {
  key: string;
  category: string;
  severity: string;
  title: string;
  recommendation: string | null;
  day: string;
  createdAt: string;
};

export async function getInsightTimeline(input: {
  actor: Actor;
  organizationId: string;
  category?: string;
  severity?: string;
  since?: Date;
}): Promise<TimelineEntry[]> {
  requirePerm(input.actor, input.organizationId, "insights.view");
  const rows = await prisma.insightRecord.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.category ? { category: input.category } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
      ...(input.since ? { createdAt: { gte: input.since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((r) => ({
    key: r.key,
    category: r.category,
    severity: r.severity,
    title: r.title,
    recommendation: r.recommendation,
    day: r.day,
    createdAt: r.createdAt.toISOString(),
  }));
}
