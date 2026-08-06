/**
 * Goal Engine — deterministic progress, trend, and projection. Projection is a
 * straight-line extrapolation from the measured daily rate of change (no AI, no
 * probabilistic forecasting). When there is no movement toward the target, the
 * estimate is explicitly null.
 */
import { computeTrend, type Direction, type TrendResult } from "./trend";
import type { Severity } from "./kpi";

export const GOAL_SCOPES = ["organization", "department", "role"] as const;
export type GoalScope = (typeof GOAL_SCOPES)[number];

export type GoalInput = {
  metricKey: string;
  target: number;
  direction: Direction;
  /** Optional baseline (e.g. the value when the goal was created) for progress. */
  baseline?: number | null;
};

export type GoalEvaluation = {
  current: number;
  target: number;
  progress: number; // 0..1
  onTarget: boolean;
  trend: TrendResult;
  severity: Severity;
  /** Deterministic straight-line days-to-target, or null if not projectable. */
  estimatedDaysToTarget: number | null;
  recommendation: string;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Evaluate a goal against a current value + a prior value measured `daysBetween`
 * days ago (defaults to 1, i.e. daily snapshots).
 */
export function evaluateGoal(
  goal: GoalInput,
  current: number,
  previous: number | null,
  daysBetween = 1,
): GoalEvaluation {
  const trend = computeTrend(current, previous, goal.direction);
  const onTarget =
    goal.direction === "higher_better" ? current >= goal.target : current <= goal.target;

  // Progress: distance covered from baseline toward target.
  const baseline =
    goal.baseline ?? (goal.direction === "higher_better" ? 0 : Math.max(goal.target * 2, current));
  let progress: number;
  if (onTarget) progress = 1;
  else if (goal.direction === "higher_better") {
    progress =
      goal.target === baseline ? 1 : clamp01((current - baseline) / (goal.target - baseline));
  } else {
    progress =
      baseline === goal.target ? 1 : clamp01((baseline - current) / (baseline - goal.target));
  }

  // Deterministic straight-line projection.
  let estimatedDaysToTarget: number | null = null;
  if (!onTarget && previous !== null && daysBetween > 0) {
    const dailyDelta = (current - previous) / daysBetween;
    const movingToward = goal.direction === "higher_better" ? dailyDelta > 0 : dailyDelta < 0;
    if (movingToward && dailyDelta !== 0) {
      // Round away floating-point noise before ceiling.
      const rawDays = Math.round(Math.abs((goal.target - current) / dailyDelta) * 1e6) / 1e6;
      estimatedDaysToTarget = Math.ceil(rawDays);
    }
  }

  const severity: Severity = onTarget
    ? "excellent"
    : progress >= 0.85
      ? "healthy"
      : progress >= 0.6
        ? "attention"
        : progress >= 0.3
          ? "warning"
          : "critical";

  const recommendation = onTarget
    ? "Goal met — maintain current performance."
    : estimatedDaysToTarget !== null
      ? `On track: at the current rate the target is reached in about ${estimatedDaysToTarget} day(s).`
      : "Not progressing toward the target — take corrective action.";

  return {
    current,
    target: goal.target,
    progress,
    onTarget,
    trend,
    severity,
    estimatedDaysToTarget,
    recommendation,
  };
}
