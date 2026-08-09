import { describe, expect, it } from "vitest";
import {
  KPI_DEFS,
  alertLevelForSeverity,
  buildInsights,
  canTransitionAlert,
  computeTrend,
  evaluateGoal,
  evaluateKpi,
  evaluateRecommendations,
  groupHealthFactors,
  kpiDef,
  kpiSeverity,
  shouldRaiseAlert,
  summarizeInsights,
  type HealthFactorLike,
  type KpiEvaluation,
} from "./index";

describe("trend engine", () => {
  it("classifies improvement/decline with direction and explains it", () => {
    expect(computeTrend(0.95, 0.9, "higher_better").type).toBe("improving");
    expect(computeTrend(0.85, 0.9, "higher_better").type).toBe("declining");
    expect(computeTrend(0.7, 0.9, "higher_better").type).toBe("rapid_decline"); // -22%
    // lower_better: backlog going down is an improvement
    expect(computeTrend(2, 10, "lower_better").type).toBe("rapid_improvement");
    expect(computeTrend(10, 2, "lower_better").type).toBe("rapid_decline");
  });
  it("returns insufficient_data without a prior value, and stable within band", () => {
    expect(computeTrend(5, null).type).toBe("insufficient_data");
    expect(computeTrend(100, 100.5, "higher_better").type).toBe("stable");
    expect(computeTrend(0.9, 0.8).explanation.length).toBeGreaterThan(0);
  });
});

describe("kpi engine", () => {
  it("evaluates value/target/trend/severity/evidence", () => {
    const def = kpiDef("attendance_rate")!;
    const evalHigh = evaluateKpi(def, 0.95, 0.9, "19/20 shifts attended");
    expect(evalHigh.onTarget).toBe(true);
    expect(evalHigh.trend.type).toBe("improving");
    expect(evalHigh.evidence).toContain("shifts");
    const evalLow = evaluateKpi(def, 0.5, 0.6, "10/20 shifts attended");
    expect(evalLow.onTarget).toBe(false);
    expect(["warning", "critical"]).toContain(evalLow.severity);
  });
  it("severity respects direction (lower_better)", () => {
    expect(kpiSeverity(0, 3, "lower_better")).toBe("excellent"); // no backlog
    expect(kpiSeverity(20, 3, "lower_better")).toBe("critical"); // huge backlog
  });
  it("registry keys are unique", () => {
    expect(new Set(KPI_DEFS.map((k) => k.key)).size).toBe(KPI_DEFS.length);
  });
});

describe("recommendation engine", () => {
  it("only recommends when justified by KPI evidence, with actions", () => {
    const backlog = evaluateKpi(kpiDef("application_backlog")!, 12, 4, "12 pending");
    const attendanceOk = evaluateKpi(kpiDef("attendance_rate")!, 0.95, 0.95, "on target");
    const recs = evaluateRecommendations([backlog, attendanceOk]);
    expect(recs.find((r) => r.kpiKey === "application_backlog")).toBeTruthy();
    expect(recs.find((r) => r.kpiKey === "attendance_rate")).toBeFalsy(); // on target, stable → no rec
    expect(recs[0]!.actions.length).toBeGreaterThan(0);
    expect(recs[0]!.reason.length).toBeGreaterThan(0);
  });
});

describe("goal engine", () => {
  it("computes progress, onTarget, and a deterministic straight-line projection", () => {
    const g = evaluateGoal(
      { metricKey: "attendance_rate", target: 0.9, direction: "higher_better", baseline: 0.5 },
      0.7,
      0.6,
    );
    expect(g.onTarget).toBe(false);
    expect(g.progress).toBeCloseTo((0.7 - 0.5) / (0.9 - 0.5), 5);
    expect(g.estimatedDaysToTarget).toBe(2); // (0.9-0.7)/0.1 = 2
  });
  it("null projection when not moving toward target", () => {
    const g = evaluateGoal(
      { metricKey: "attendance_rate", target: 0.9, direction: "higher_better" },
      0.6,
      0.7,
    );
    expect(g.estimatedDaysToTarget).toBeNull();
    expect(g.onTarget).toBe(false);
  });
  it("met goal reports full progress", () => {
    const g = evaluateGoal(
      { metricKey: "automation_success", target: 0.99, direction: "higher_better" },
      1,
      0.99,
    );
    expect(g.onTarget).toBe(true);
    expect(g.progress).toBe(1);
  });
});

describe("alert engine", () => {
  it("maps severity to level and gates raising", () => {
    expect(alertLevelForSeverity("critical")).toBe("critical");
    expect(alertLevelForSeverity("excellent")).toBe("success");
    expect(shouldRaiseAlert("warning")).toBe(true);
    expect(shouldRaiseAlert("healthy")).toBe(false);
  });
  it("enforces lifecycle transitions", () => {
    expect(canTransitionAlert("open", "acknowledged")).toBe(true);
    expect(canTransitionAlert("resolved", "open")).toBe(false);
  });
});

describe("insight builder + health grouping + summary", () => {
  const kpis: KpiEvaluation[] = [
    evaluateKpi(kpiDef("attendance_rate")!, 0.5, 0.7, "10/20"),
    evaluateKpi(kpiDef("automation_success")!, 1, 0.99, "all passed"),
    evaluateKpi(kpiDef("training_completion")!, 0.96, 0.96, "on target"),
  ];
  it("surfaces off-target/notable insights only, most severe first", () => {
    const insights = buildInsights(kpis);
    expect(insights.find((i) => i.key === "insight_attendance_rate")).toBeTruthy();
    expect(insights.find((i) => i.key === "insight_training_completion")).toBeFalsy(); // on target + stable
    expect(insights[0]!.severity === "critical" || insights[0]!.severity === "warning").toBe(true);
  });
  it("groups health factors into categories with weighted score", () => {
    const factors: HealthFactorLike[] = [
      {
        key: "attendance",
        label: "Attendance",
        score: 80,
        weight: 1.5,
        target: 90,
        trend: "steady",
        explanation: "",
        recommendedAction: "",
      },
      {
        key: "activity_compliance",
        label: "Activity",
        score: 60,
        weight: 1.5,
        target: 90,
        trend: "steady",
        explanation: "",
        recommendedAction: "",
      },
      {
        key: "training",
        label: "Training",
        score: 100,
        weight: 1,
        target: 90,
        trend: "steady",
        explanation: "",
        recommendedAction: "",
      },
    ];
    const groups = groupHealthFactors(factors);
    const ops = groups.find((g) => g.key === "operations")!;
    expect(ops.score).toBe(70); // (80+60)/2
    expect(groups.find((g) => g.key === "training")!.score).toBe(100);
  });
  it("summarizes insights deterministically incl. health delta", () => {
    const lines = summarizeInsights(buildInsights(kpis), { previous: 67, current: 73 });
    expect(lines.some((l) => l.text.includes("Community Health improved from 67 to 73"))).toBe(
      true,
    );
  });
});
