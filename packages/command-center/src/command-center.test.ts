import { describe, expect, it } from "vitest";
import {
  QUICK_ACTIONS,
  WIDGETS,
  buildExecutiveSummary,
  computeHealth,
  filterActions,
  normalizeLayout,
  severityOf,
  trendFrom,
  visibleWidgets,
  type HealthInputs,
  type WidgetLayoutItem,
} from "./index";

const baseInputs: HealthInputs = {
  activeMembers: 40,
  newMembers30d: 3,
  targetMembers: 50,
  trainingCompleted: 8,
  trainingAssigned: 10,
  attendanceRate: 0.8,
  activityComplianceRate: 0.7,
  automationSuccessRate: 1,
  automationRuns: 5,
  websiteViews7d: 120,
  serverOnline: true,
  pendingApprovals: 2,
  outstandingWorkflows: 1,
  departments: 4,
  understaffedDepartments: 1,
};

describe("community health engine", () => {
  it("is deterministic and bounded 0..100", () => {
    const a = computeHealth(baseInputs);
    const b = computeHealth(baseInputs);
    expect(a.overall).toBe(b.overall);
    expect(a.overall).toBeGreaterThanOrEqual(0);
    expect(a.overall).toBeLessThanOrEqual(100);
    expect(a.factors).toHaveLength(WIDGETS.length > 0 ? a.factors.length : 0);
  });
  it("exposes value/target/severity/explanation/recommendedAction per factor", () => {
    const r = computeHealth(baseInputs);
    for (const f of r.factors) {
      expect(f.explanation.length).toBeGreaterThan(0);
      expect(f.recommendedAction.length).toBeGreaterThan(0);
      expect(f.severity).toBe(severityOf(f.score));
      expect(f.target).toBe(90);
    }
  });
  it("penalizes an offline server and approval backlog", () => {
    const healthy = computeHealth(baseInputs).overall;
    const degraded = computeHealth({
      ...baseInputs,
      serverOnline: false,
      pendingApprovals: 20,
    }).overall;
    expect(degraded).toBeLessThan(healthy);
  });
  it("respects custom weighting", () => {
    const weighted = computeHealth(
      { ...baseInputs, serverOnline: false },
      { server_availability: 10 },
    );
    const normal = computeHealth({ ...baseInputs, serverOnline: false });
    expect(weighted.overall).toBeLessThan(normal.overall); // offline server dominates when weighted heavily
  });
  it("maps severity bands", () => {
    expect(severityOf(95)).toBe("excellent");
    expect(severityOf(80)).toBe("healthy");
    expect(severityOf(65)).toBe("attention");
    expect(severityOf(45)).toBe("warning");
    expect(severityOf(10)).toBe("critical");
  });
  it("computes deterministic trend from a prior score", () => {
    expect(trendFrom(80, 70)).toBe("up");
    expect(trendFrom(70, 80)).toBe("down");
    expect(trendFrom(80, 81)).toBe("steady");
    expect(trendFrom(80, null)).toBe("steady");
  });
});

describe("executive summary", () => {
  it("surfaces the most urgent items and is calm when clear", () => {
    const busy = buildExecutiveSummary({
      pendingApplications: 5,
      assignedToMe: 2,
      outstandingWorkflows: 1,
      shiftsStartingSoon: 2,
      trainingOverdue: 0,
      automationFailures: 1,
      automationSuccessRate: 0.8,
      serverOnline: false,
      healthSeverity: "warning",
      understaffedDepartments: 1,
    });
    expect(busy.some((l) => l.text.includes("require review"))).toBe(true);
    expect(busy.some((l) => l.severity === "critical")).toBe(true);
    const calm = buildExecutiveSummary({
      pendingApplications: 0,
      assignedToMe: 0,
      outstandingWorkflows: 0,
      shiftsStartingSoon: 0,
      trainingOverdue: 0,
      automationFailures: 0,
      automationSuccessRate: 1,
      serverOnline: true,
      healthSeverity: "excellent",
      understaffedDepartments: 0,
    });
    expect(calm).toHaveLength(1);
    expect(calm[0]!.severity).toBe("excellent");
  });
});

describe("widget registry + personalization", () => {
  it("filters widgets by feature + permission", () => {
    const all = visibleWidgets(
      () => true,
      () => true,
    );
    const limited = visibleWidgets(
      (f) => f !== "automations.builder",
      (p) => p !== "cad.access",
    );
    expect(all.length).toBeGreaterThan(limited.length);
    expect(limited.find((w) => w.key === "automation_health")).toBeUndefined();
  });
  it("normalizes a saved layout, dropping inaccessible + appending new", () => {
    const available = visibleWidgets(
      () => true,
      () => true,
    );
    const saved: WidgetLayoutItem[] = [
      { key: available[2]!.key, hidden: true, order: 0, size: "sm" },
      { key: available[0]!.key, hidden: false, order: 1, size: "lg" },
      { key: "removed_widget", hidden: false, order: 2, size: "md" },
    ];
    const norm = normalizeLayout(saved, available);
    expect(norm.find((n) => n.key === "removed_widget")).toBeUndefined();
    expect(norm[0]!.key).toBe(available[2]!.key); // saved order preserved
    expect(norm[0]!.hidden).toBe(true);
    expect(norm).toHaveLength(available.length); // new widgets appended
  });
  it("filters quick actions by entitlement + permission", () => {
    const filtered = filterActions(
      QUICK_ACTIONS,
      () => true,
      (p) => p !== "automation.view",
    );
    expect(filtered.find((a) => a.key === "run_automation")).toBeUndefined();
  });
});
