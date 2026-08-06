/**
 * KPI Engine — a registry of reusable KPIs and a deterministic evaluator that
 * attaches current/previous/target/trend/health/evidence. New modules register
 * KPIs here without touching the engine.
 */
import { computeTrend, type Direction, type TrendResult } from "./trend";

export type Severity = "excellent" | "healthy" | "attention" | "warning" | "critical";
export type KpiUnit = "ratio" | "percent" | "count" | "hours" | "score";

export type KpiDef = {
  key: string;
  label: string;
  unit: KpiUnit;
  direction: Direction;
  target: number;
  category: string;
};

export const KPI_DEFS: KpiDef[] = [
  {
    key: "attendance_rate",
    label: "Attendance Rate",
    unit: "ratio",
    direction: "higher_better",
    target: 0.9,
    category: "operations",
  },
  {
    key: "training_completion",
    label: "Training Completion",
    unit: "ratio",
    direction: "higher_better",
    target: 0.95,
    category: "training",
  },
  {
    key: "automation_success",
    label: "Automation Success",
    unit: "ratio",
    direction: "higher_better",
    target: 0.99,
    category: "automation",
  },
  {
    key: "community_health",
    label: "Community Health",
    unit: "score",
    direction: "higher_better",
    target: 85,
    category: "overview",
  },
  {
    key: "website_views_7d",
    label: "Website Visitors (7d)",
    unit: "count",
    direction: "higher_better",
    target: 100,
    category: "website",
  },
  {
    key: "application_backlog",
    label: "Application Backlog",
    unit: "count",
    direction: "lower_better",
    target: 3,
    category: "workflow",
  },
  {
    key: "avg_review_hours",
    label: "Avg Application Review Time",
    unit: "hours",
    direction: "lower_better",
    target: 24,
    category: "workflow",
  },
  {
    key: "active_members",
    label: "Active Members",
    unit: "count",
    direction: "higher_better",
    target: 25,
    category: "people",
  },
  {
    key: "department_staffing",
    label: "Department Staffing",
    unit: "ratio",
    direction: "higher_better",
    target: 1,
    category: "people",
  },
  {
    key: "automation_failures",
    label: "Automation Failures",
    unit: "count",
    direction: "lower_better",
    target: 0,
    category: "automation",
  },
  {
    key: "recruitment_30d",
    label: "Recruitment (30d)",
    unit: "count",
    direction: "higher_better",
    target: 3,
    category: "people",
  },
];

const KPI_BY_KEY = new Map(KPI_DEFS.map((k) => [k.key, k]));

export function kpiDef(key: string): KpiDef | undefined {
  return KPI_BY_KEY.get(key);
}

export type KpiEvaluation = {
  key: string;
  label: string;
  unit: KpiUnit;
  category: string;
  current: number;
  previous: number | null;
  target: number;
  direction: Direction;
  trend: TrendResult;
  severity: Severity;
  onTarget: boolean;
  evidence: string;
};

/**
 * Severity from a value's distance to target, respecting direction. Deterministic
 * banding on the fraction of target achieved.
 */
export function kpiSeverity(current: number, target: number, direction: Direction): Severity {
  // ratio of achievement where 1 = exactly on target, >1 = better than target.
  let ratio: number;
  if (direction === "higher_better") {
    ratio = target === 0 ? (current >= 0 ? 1 : 0) : current / target;
  } else {
    // lower is better: on/under target is good; over target degrades.
    if (current <= target)
      ratio =
        1 + (target === 0 ? (current === 0 ? 0 : -1) : (target - current) / Math.max(target, 1));
    else
      ratio =
        target === 0
          ? Math.max(0, 1 - current)
          : Math.max(0, 1 - (current - target) / Math.max(target, 1));
  }
  if (ratio >= 1.1) return "excellent";
  if (ratio >= 0.98) return "healthy";
  if (ratio >= 0.85) return "attention";
  if (ratio >= 0.6) return "warning";
  return "critical";
}

export function evaluateKpi(
  def: KpiDef,
  current: number,
  previous: number | null,
  evidence: string,
  targetOverride?: number,
): KpiEvaluation {
  const target = targetOverride ?? def.target;
  const trend = computeTrend(current, previous, def.direction);
  const severity = kpiSeverity(current, target, def.direction);
  const onTarget = def.direction === "higher_better" ? current >= target : current <= target;
  return {
    key: def.key,
    label: def.label,
    unit: def.unit,
    category: def.category,
    current,
    previous,
    target,
    direction: def.direction,
    trend,
    severity,
    onTarget,
    evidence,
  };
}

export function formatKpiValue(unit: KpiUnit, value: number): string {
  switch (unit) {
    case "ratio":
    case "percent":
      return `${Math.round(value * 100)}%`;
    case "hours":
      return `${Math.round(value * 10) / 10}h`;
    case "score":
      return `${Math.round(value)}`;
    default:
      return `${Math.round(value)}`;
  }
}
