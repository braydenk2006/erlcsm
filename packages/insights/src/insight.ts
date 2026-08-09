/**
 * Insight builder + Insight Registry helpers. Insights are constructed
 * deterministically from evaluated KPIs (each carries its supporting evidence),
 * plus a health-factor grouping and a structured executive summary. Every field
 * traces back to measured platform data.
 */
import { isDeclining, isImproving, type TrendResult } from "./trend";
import type { KpiEvaluation, Severity } from "./kpi";
import { evaluateRecommendations } from "./recommendations";

export const INSIGHT_CATEGORIES = [
  "operations",
  "workflow",
  "automation",
  "website",
  "training",
  "people",
  "overview",
] as const;
export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

export type Insight = {
  key: string;
  category: string;
  severity: Severity;
  title: string;
  explanation: string;
  current: number;
  previous: number | null;
  trendType: TrendResult["type"];
  recommendation: string | null;
  evidence: string;
};

/** Build insights from KPIs that are off-target or exhibit a notable trend. */
export function buildInsights(kpis: KpiEvaluation[]): Insight[] {
  const recs = new Map(evaluateRecommendations(kpis).map((r) => [r.kpiKey, r.text]));
  const insights: Insight[] = [];
  for (const k of kpis) {
    const notableTrend = isImproving(k.trend.type) || isDeclining(k.trend.type);
    if (k.onTarget && !notableTrend) continue; // nothing worth surfacing
    const movement = isImproving(k.trend.type)
      ? "improving"
      : isDeclining(k.trend.type)
        ? "declining"
        : k.onTarget
          ? "on target"
          : "off target";
    insights.push({
      key: `insight_${k.key}`,
      category: k.category,
      severity: k.severity,
      title: `${k.label} ${movement}`,
      explanation: k.trend.explanation,
      current: k.current,
      previous: k.previous,
      trendType: k.trend.type,
      recommendation: recs.get(k.key) ?? null,
      evidence: k.evidence,
    });
  }
  const rank: Record<string, number> = {
    critical: 0,
    warning: 1,
    attention: 2,
    healthy: 3,
    excellent: 4,
  };
  return insights.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
}

export function recentImprovements(insights: Insight[]): Insight[] {
  return insights.filter((i) => isImproving(i.trendType));
}
export function recentDeclines(insights: Insight[]): Insight[] {
  return insights.filter((i) => isDeclining(i.trendType));
}

// ---------------------------------------------------------------------------
// Community Health factor grouping (expansion of the Phase 8 health engine)
// ---------------------------------------------------------------------------

export type HealthFactorLike = {
  key: string;
  label: string;
  score: number;
  weight: number;
  target: number;
  trend: string;
  explanation: string;
  recommendedAction: string;
};

export const HEALTH_CATEGORIES = [
  { key: "recruitment", label: "Recruitment", factors: ["recruitment", "staffing"] },
  { key: "training", label: "Training", factors: ["training"] },
  { key: "operations", label: "Operations", factors: ["attendance", "activity_compliance"] },
  { key: "automation", label: "Automation", factors: ["automation_health"] },
  { key: "website", label: "Website", factors: ["website_activity"] },
  { key: "workflow", label: "Workflow", factors: ["pending_approvals", "outstanding_workflows"] },
  {
    key: "departments",
    label: "Departments",
    factors: ["department_staffing", "server_availability"],
  },
] as const;

export type HealthCategory = {
  key: string;
  label: string;
  score: number;
  weight: number;
  factors: HealthFactorLike[];
};

/** Group individual health factors into the higher-level categories. */
export function groupHealthFactors(factors: HealthFactorLike[]): HealthCategory[] {
  const byKey = new Map(factors.map((f) => [f.key, f]));
  const out: HealthCategory[] = [];
  for (const cat of HEALTH_CATEGORIES) {
    const members = cat.factors
      .map((k) => byKey.get(k))
      .filter((f): f is HealthFactorLike => Boolean(f));
    if (members.length === 0) continue;
    const totalWeight = members.reduce((s, f) => s + f.weight, 0);
    const score =
      totalWeight > 0
        ? Math.round(members.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight)
        : 0;
    out.push({ key: cat.key, label: cat.label, score, weight: totalWeight, factors: members });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Deterministic executive summary from structured insights
// ---------------------------------------------------------------------------

export type SummaryLine = { text: string; severity: Severity };

export function summarizeInsights(
  insights: Insight[],
  healthDelta?: { previous: number | null; current: number },
): SummaryLine[] {
  const lines: SummaryLine[] = [];
  if (healthDelta && healthDelta.previous !== null) {
    if (healthDelta.current > healthDelta.previous)
      lines.push({
        text: `Community Health improved from ${healthDelta.previous} to ${healthDelta.current}.`,
        severity: "healthy",
      });
    else if (healthDelta.current < healthDelta.previous)
      lines.push({
        text: `Community Health declined from ${healthDelta.previous} to ${healthDelta.current}.`,
        severity: "warning",
      });
  }
  for (const i of insights
    .filter((x) => x.severity === "critical" || x.severity === "warning")
    .slice(0, 5)) {
    lines.push({ text: `${i.title}. ${i.recommendation ?? i.explanation}`, severity: i.severity });
  }
  for (const i of recentImprovements(insights).slice(0, 3)) {
    lines.push({ text: `${i.title}: ${i.evidence}`, severity: "healthy" });
  }
  if (lines.length === 0)
    lines.push({
      text: "All tracked metrics are on target with no notable changes.",
      severity: "excellent",
    });
  return lines;
}
