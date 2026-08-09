/**
 * Community Health Engine — deterministic, weighted, explainable. No AI.
 *
 * Each factor turns raw platform metrics into a 0-100 score, a severity band, a
 * plain-language explanation, and a recommended action. The overall score is the
 * weighted average of enabled factors. Organizations can override weights.
 */

export type Severity = "excellent" | "healthy" | "attention" | "warning" | "critical";
export type Trend = "up" | "down" | "steady";

export const HEALTH_FACTOR_KEYS = [
  "recruitment",
  "staffing",
  "training",
  "attendance",
  "activity_compliance",
  "automation_health",
  "website_activity",
  "server_availability",
  "pending_approvals",
  "outstanding_workflows",
  "department_staffing",
] as const;
export type HealthFactorKey = (typeof HEALTH_FACTOR_KEYS)[number];

export const FACTOR_META: Record<HealthFactorKey, { label: string; weight: number }> = {
  recruitment: { label: "Recruitment", weight: 1 },
  staffing: { label: "Staffing", weight: 1.5 },
  training: { label: "Training completion", weight: 1 },
  attendance: { label: "Attendance", weight: 1.5 },
  activity_compliance: { label: "Activity compliance", weight: 1.5 },
  automation_health: { label: "Automation health", weight: 1 },
  website_activity: { label: "Website activity", weight: 0.5 },
  server_availability: { label: "Server availability", weight: 1 },
  pending_approvals: { label: "Pending approvals", weight: 1 },
  outstanding_workflows: { label: "Outstanding workflows", weight: 1 },
  department_staffing: { label: "Department staffing", weight: 1 },
};

export type HealthInputs = {
  activeMembers: number;
  newMembers30d: number;
  targetMembers: number;
  trainingCompleted: number;
  trainingAssigned: number;
  attendanceRate: number; // 0..1
  activityComplianceRate: number; // 0..1
  automationSuccessRate: number; // 0..1
  automationRuns: number;
  websiteViews7d: number;
  serverOnline: boolean;
  pendingApprovals: number;
  outstandingWorkflows: number;
  departments: number;
  understaffedDepartments: number;
};

export type HealthFactor = {
  key: HealthFactorKey;
  label: string;
  score: number; // 0..100
  target: number; // 0..100 (100 = ideal)
  weight: number;
  severity: Severity;
  trend: Trend;
  value: string;
  explanation: string;
  recommendedAction: string;
};

export type HealthResult = {
  overall: number;
  severity: Severity;
  trend: Trend;
  factors: HealthFactor[];
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const pct = (n: number) => clamp(Math.round(n * 100));

export function severityOf(score: number): Severity {
  if (score >= 90) return "excellent";
  if (score >= 75) return "healthy";
  if (score >= 60) return "attention";
  if (score >= 40) return "warning";
  return "critical";
}

/** A factor's score relative to a decreasing-is-better backlog count. */
function backlogScore(count: number, tolerance: number): number {
  if (count <= 0) return 100;
  return clamp(Math.round(100 - (count / tolerance) * 100));
}

function computeFactorScores(
  i: HealthInputs,
): Record<HealthFactorKey, { score: number; value: string; explanation: string; action: string }> {
  const trainingPct = i.trainingAssigned > 0 ? i.trainingCompleted / i.trainingAssigned : 1;
  const recruitTarget = Math.max(1, Math.round(i.targetMembers * 0.05)); // 5% monthly growth target
  const staffTarget = Math.max(1, i.targetMembers);
  return {
    recruitment: {
      score: clamp(Math.round((i.newMembers30d / recruitTarget) * 100)),
      value: `${i.newMembers30d} new / 30d`,
      explanation: `${i.newMembers30d} members joined in the last 30 days (target ${recruitTarget}).`,
      action:
        i.newMembers30d >= recruitTarget
          ? "Recruitment is on track."
          : "Open applications or promote your community to grow recruitment.",
    },
    staffing: {
      score: clamp(Math.round((i.activeMembers / staffTarget) * 100)),
      value: `${i.activeMembers}/${staffTarget}`,
      explanation: `${i.activeMembers} active members against a target of ${staffTarget}.`,
      action:
        i.activeMembers >= staffTarget
          ? "Staffing meets target."
          : "Recruit or reactivate members to reach your staffing target.",
    },
    training: {
      score: pct(trainingPct),
      value: `${pct(trainingPct)}%`,
      explanation: `${i.trainingCompleted} of ${i.trainingAssigned} assigned trainings completed.`,
      action:
        trainingPct >= 0.8
          ? "Training completion is healthy."
          : "Follow up with members who have overdue training.",
    },
    attendance: {
      score: pct(i.attendanceRate),
      value: `${pct(i.attendanceRate)}%`,
      explanation: `${pct(i.attendanceRate)}% of scheduled shifts were attended.`,
      action:
        i.attendanceRate >= 0.75
          ? "Attendance is strong."
          : "Review no-shows and adjust scheduling or reminders.",
    },
    activity_compliance: {
      score: pct(i.activityComplianceRate),
      value: `${pct(i.activityComplianceRate)}%`,
      explanation: `${pct(i.activityComplianceRate)}% of members meet their activity quota.`,
      action:
        i.activityComplianceRate >= 0.7
          ? "Activity compliance is on target."
          : "Reach out to members below their activity quota.",
    },
    automation_health: {
      score: i.automationRuns === 0 ? 100 : pct(i.automationSuccessRate),
      value: i.automationRuns === 0 ? "no runs" : `${pct(i.automationSuccessRate)}%`,
      explanation:
        i.automationRuns === 0
          ? "No automations have run recently."
          : `${pct(i.automationSuccessRate)}% of automation runs succeeded.`,
      action:
        i.automationSuccessRate >= 0.9 || i.automationRuns === 0
          ? "Automations are healthy."
          : "Investigate failed automations in the Automation Platform.",
    },
    website_activity: {
      score: clamp(Math.round((i.websiteViews7d / 100) * 100)),
      value: `${i.websiteViews7d} views / 7d`,
      explanation: `${i.websiteViews7d} public website views in the last 7 days.`,
      action:
        i.websiteViews7d >= 100
          ? "Website traffic is healthy."
          : "Publish announcements or share your site to drive traffic.",
    },
    server_availability: {
      score: i.serverOnline ? 100 : 30,
      value: i.serverOnline ? "online" : "offline",
      explanation: i.serverOnline
        ? "The linked ER:LC server is reachable."
        : "The linked ER:LC server is offline or unreachable.",
      action: i.serverOnline
        ? "Server integration is healthy."
        : "Check your ER:LC server and integration credentials.",
    },
    pending_approvals: {
      score: backlogScore(i.pendingApprovals, 10),
      value: `${i.pendingApprovals} pending`,
      explanation: `${i.pendingApprovals} items are waiting for review.`,
      action:
        i.pendingApprovals === 0
          ? "No approval backlog."
          : "Review pending applications and workflow submissions.",
    },
    outstanding_workflows: {
      score: backlogScore(i.outstandingWorkflows, 10),
      value: `${i.outstandingWorkflows} open`,
      explanation: `${i.outstandingWorkflows} workflows are awaiting action (revisions or assignments).`,
      action:
        i.outstandingWorkflows === 0
          ? "No outstanding workflows."
          : "Resolve revision requests and unassigned reviews.",
    },
    department_staffing: {
      score:
        i.departments === 0
          ? 100
          : clamp(Math.round(((i.departments - i.understaffedDepartments) / i.departments) * 100)),
      value: `${i.departments - i.understaffedDepartments}/${i.departments} staffed`,
      explanation: `${i.understaffedDepartments} of ${i.departments} departments are understaffed.`,
      action:
        i.understaffedDepartments === 0
          ? "Departments are well staffed."
          : "Assign members or recruit for understaffed departments.",
    },
  };
}

export function computeHealth(
  inputs: HealthInputs,
  weightOverrides?: Partial<Record<HealthFactorKey, number>>,
): HealthResult {
  const scores = computeFactorScores(inputs);
  const factors: HealthFactor[] = HEALTH_FACTOR_KEYS.map((key) => {
    const meta = FACTOR_META[key];
    const weight = weightOverrides?.[key] ?? meta.weight;
    const s = scores[key];
    return {
      key,
      label: meta.label,
      score: s.score,
      target: 90,
      weight,
      severity: severityOf(s.score),
      trend: "steady" as Trend,
      value: s.value,
      explanation: s.explanation,
      recommendedAction: s.action,
    };
  });

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const overall =
    totalWeight > 0
      ? Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight)
      : 0;

  return { overall, severity: severityOf(overall), trend: "steady", factors };
}

/** Deterministic trend from a prior score (>2 points swing registers). */
export function trendFrom(current: number, previous: number | null): Trend {
  if (previous === null) return "steady";
  if (current - previous > 2) return "up";
  if (previous - current > 2) return "down";
  return "steady";
}
