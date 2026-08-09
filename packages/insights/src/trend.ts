/**
 * Trend Engine — deterministic, explainable. Compares a current value to a prior
 * value over a period and classifies the movement. "Direction" says whether a
 * higher number is better (attendance) or worse (backlog).
 */

export const TREND_PERIODS = ["24h", "7d", "30d", "90d", "365d", "custom"] as const;
export type TrendPeriod = (typeof TREND_PERIODS)[number];

export const TREND_TYPES = [
  "improving",
  "stable",
  "declining",
  "rapid_improvement",
  "rapid_decline",
  "insufficient_data",
] as const;
export type TrendType = (typeof TREND_TYPES)[number];

export type Direction = "higher_better" | "lower_better";

export type TrendResult = {
  type: TrendType;
  changeAbs: number;
  changePct: number | null;
  explanation: string;
};

export type TrendThresholds = {
  /** Minimum % change (of previous) to count as a move at all. */
  stableBand: number;
  /** % change at/above which a move is "rapid". */
  rapidBand: number;
};

export const DEFAULT_TREND_THRESHOLDS: TrendThresholds = { stableBand: 0.02, rapidBand: 0.2 };

/**
 * Classify the movement from `previous` to `current`. Returns `insufficient_data`
 * when there is no comparable prior value. The explanation states exactly how the
 * classification was derived (no inference).
 */
export function computeTrend(
  current: number,
  previous: number | null | undefined,
  direction: Direction = "higher_better",
  thresholds: TrendThresholds = DEFAULT_TREND_THRESHOLDS,
): TrendResult {
  if (previous === null || previous === undefined) {
    return {
      type: "insufficient_data",
      changeAbs: 0,
      changePct: null,
      explanation: "No prior data point to compare against.",
    };
  }
  const changeAbs = current - previous;
  const denom = Math.abs(previous);
  const changePct = denom === 0 ? (changeAbs === 0 ? 0 : null) : changeAbs / denom;
  const magnitude = changePct === null ? Infinity : Math.abs(changePct);

  if (magnitude < thresholds.stableBand) {
    return {
      type: "stable",
      changeAbs,
      changePct,
      explanation: `Value moved ${fmtPct(changePct)} (within the ±${fmtPct(thresholds.stableBand)} stable band).`,
    };
  }

  // A "good" move is up when higher is better, down when lower is better.
  const improved = direction === "higher_better" ? changeAbs > 0 : changeAbs < 0;
  const rapid = magnitude >= thresholds.rapidBand;
  const type: TrendType = improved
    ? rapid
      ? "rapid_improvement"
      : "improving"
    : rapid
      ? "rapid_decline"
      : "declining";
  const dirWord =
    direction === "higher_better"
      ? changeAbs > 0
        ? "rose"
        : "fell"
      : changeAbs > 0
        ? "rose"
        : "fell";
  return {
    type,
    changeAbs,
    changePct,
    explanation: `Value ${dirWord} ${fmtPct(changePct)} from ${round(previous)} to ${round(current)} (${direction.replace("_", " ")}).`,
  };
}

export function isImproving(type: TrendType): boolean {
  return type === "improving" || type === "rapid_improvement";
}
export function isDeclining(type: TrendType): boolean {
  return type === "declining" || type === "rapid_decline";
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
function fmtPct(pct: number | null): string {
  if (pct === null) return "—";
  return `${(pct * 100 >= 0 ? "+" : "") + (Math.round(pct * 1000) / 10).toFixed(1)}%`;
}
