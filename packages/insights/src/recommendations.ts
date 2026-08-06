/**
 * Recommendation Engine — deterministic. Each rule maps a KPI condition to a
 * justified recommendation and concrete module actions. A recommendation is only
 * produced when its KPI evidence supports it; nothing is inferred or invented.
 */
import { isDeclining } from "./trend";
import type { KpiEvaluation } from "./kpi";

export type RecommendationAction = { key: string; label: string; href: string };

export type Recommendation = {
  key: string;
  kpiKey: string;
  severity: KpiEvaluation["severity"];
  text: string;
  reason: string;
  actions: RecommendationAction[];
};

type Rule = {
  kpiKey: string;
  /** Fires only when the KPI is off target or declining (justified by data). */
  when: (k: KpiEvaluation) => boolean;
  text: string;
  actions: RecommendationAction[];
};

const offTargetOrDeclining = (k: KpiEvaluation) => !k.onTarget || isDeclining(k.trend.type);

export const RECOMMENDATION_RULES: Rule[] = [
  {
    kpiKey: "avg_review_hours",
    when: (k) => k.current > k.target,
    text: "Application review time exceeds target. Assign another reviewer to clear the queue faster.",
    actions: [{ key: "assign_reviewer", label: "Review applications", href: "/app/applications" }],
  },
  {
    kpiKey: "application_backlog",
    when: (k) => k.current > k.target,
    text: "Application backlog is above target. Review pending applications or add reviewers.",
    actions: [{ key: "open_applications", label: "Open applications", href: "/app/applications" }],
  },
  {
    kpiKey: "attendance_rate",
    when: offTargetOrDeclining,
    text: "Attendance is below target. Schedule an additional patrol and review no-shows.",
    actions: [{ key: "create_patrol", label: "Create shift", href: "/app/schedule?new=1" }],
  },
  {
    kpiKey: "training_completion",
    when: offTargetOrDeclining,
    text: "Training completion is below threshold. Assign mandatory refresher training.",
    actions: [{ key: "assign_training", label: "Assign training", href: "/app/training" }],
  },
  {
    kpiKey: "automation_failures",
    when: (k) => k.current > k.target,
    text: "Automation failures increased. Inspect failed executions.",
    actions: [
      { key: "inspect_automation", label: "Inspect automations", href: "/app/automations" },
    ],
  },
  {
    kpiKey: "automation_success",
    when: (k) => k.current < k.target && isDeclining(k.trend.type),
    text: "Automation success rate dropped below target. Inspect recent failures.",
    actions: [
      { key: "inspect_automation", label: "Inspect automations", href: "/app/automations" },
    ],
  },
  {
    kpiKey: "website_views_7d",
    when: (k) => isDeclining(k.trend.type) || !k.onTarget,
    text: "Website traffic is declining. Publish an announcement and share your site.",
    actions: [
      {
        key: "publish_announcement",
        label: "Publish announcement",
        href: "/app/announcements?new=1",
      },
    ],
  },
  {
    kpiKey: "recruitment_30d",
    when: (k) => !k.onTarget,
    text: "Recruitment is below target. Open applications or promote your community.",
    actions: [{ key: "open_applications", label: "Open applications", href: "/app/applications" }],
  },
  {
    kpiKey: "department_staffing",
    when: offTargetOrDeclining,
    text: "One or more departments are understaffed. Assign members or recruit.",
    actions: [{ key: "open_departments", label: "Open departments", href: "/app/departments" }],
  },
  {
    kpiKey: "community_health",
    when: (k) => !k.onTarget && isDeclining(k.trend.type),
    text: "Community Health is below target and declining. Review the contributing factors.",
    actions: [{ key: "open_command_center", label: "Open Command Center", href: "/app" }],
  },
];

/** Produce deterministic recommendations from the evaluated KPIs. */
export function evaluateRecommendations(kpis: KpiEvaluation[]): Recommendation[] {
  const byKey = new Map(kpis.map((k) => [k.key, k]));
  const out: Recommendation[] = [];
  for (const rule of RECOMMENDATION_RULES) {
    const kpi = byKey.get(rule.kpiKey);
    if (!kpi || !rule.when(kpi)) continue;
    out.push({
      key: `rec_${rule.kpiKey}`,
      kpiKey: rule.kpiKey,
      severity: kpi.severity,
      text: rule.text,
      reason: kpi.evidence || kpi.trend.explanation,
      actions: rule.actions,
    });
  }
  // Most severe first.
  const rank: Record<string, number> = {
    critical: 0,
    warning: 1,
    attention: 2,
    healthy: 3,
    excellent: 4,
  };
  return out.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
}
