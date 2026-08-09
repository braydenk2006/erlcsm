import { describe, expect, it } from "vitest";
import {
  attendedStatus,
  buildTimeline,
  canTransitionSession,
  complianceStatus,
  computeActiveMinutes,
  computeAttendanceStats,
  computeMetrics,
  isCreditEvent,
  minutesBetween,
} from "./index";

describe("time calculations", () => {
  it("computes minutes between dates", () => {
    expect(minutesBetween(new Date(0), new Date(90 * 60_000))).toBe(90);
    expect(minutesBetween(new Date(90 * 60_000), new Date(0))).toBe(0);
  });
  it("subtracts break time from active minutes, never negative", () => {
    const start = new Date(0);
    const end = new Date(120 * 60_000);
    expect(computeActiveMinutes(start, end, 30)).toBe(90);
    expect(computeActiveMinutes(start, end, 200)).toBe(0);
  });
});

describe("credit events", () => {
  it("marks the correct events as activity credit", () => {
    expect(isCreditEvent("SHIFT_COMPLETED")).toBe(true);
    expect(isCreditEvent("SESSION_ATTENDED")).toBe(true);
    expect(isCreditEvent("MANUAL_ADJUSTMENT")).toBe(true);
    expect(isCreditEvent("SHIFT_STARTED")).toBe(false);
    expect(isCreditEvent("SESSION_HOSTED")).toBe(false);
  });
});

describe("metrics derive from participation events", () => {
  it("aggregates shifts, sessions, hosting and adjustments", () => {
    const m = computeMetrics([
      { type: "SHIFT_COMPLETED", durationMinutes: 120, metadata: { breakMinutes: 15 } },
      { type: "SHIFT_COMPLETED", durationMinutes: 60, metadata: { breakMinutes: 0 } },
      { type: "SESSION_ATTENDED", durationMinutes: 45 },
      { type: "SESSION_HOSTED" },
      { type: "MANUAL_ADJUSTMENT", durationMinutes: 30 },
      { type: "SHIFT_STARTED" },
    ]);
    expect(m.shiftMinutes).toBe(180);
    expect(m.breakMinutes).toBe(15);
    expect(m.completedShifts).toBe(2);
    expect(m.avgShiftMinutes).toBe(90);
    expect(m.sessionMinutes).toBe(45);
    expect(m.sessionsAttended).toBe(1);
    expect(m.hostedSessions).toBe(1);
    expect(m.adjustmentMinutes).toBe(30);
    expect(m.totalActiveMinutes).toBe(255);
  });
});

describe("attendance", () => {
  it("counts present/late/left-early as attended and computes rates", () => {
    expect(attendedStatus("PRESENT")).toBe(true);
    expect(attendedStatus("LATE")).toBe(true);
    expect(attendedStatus("ABSENT")).toBe(false);
    const stats = computeAttendanceStats(["PRESENT", "LATE", "ABSENT", "EXCUSED", "PRESENT"]);
    expect(stats.present).toBe(3);
    expect(stats.late).toBe(1);
    // eligible = 5 - 1 excused = 4; attended = 3 -> 0.75
    expect(stats.attendanceRate).toBeCloseTo(0.75);
    expect(stats.lateRate).toBeCloseTo(1 / 3);
  });
});

describe("compliance + transitions + timeline", () => {
  it("computes compliance thresholds", () => {
    expect(complianceStatus(120, 120)).toBe("met");
    expect(complianceStatus(100, 120)).toBe("at_risk");
    expect(complianceStatus(50, 120)).toBe("below");
    expect(complianceStatus(0, 0)).toBe("met");
  });
  it("enforces session lifecycle transitions", () => {
    expect(canTransitionSession("DRAFT", "SCHEDULED")).toBe(true);
    expect(canTransitionSession("ACTIVE", "COMPLETED")).toBe(true);
    expect(canTransitionSession("COMPLETED", "ACTIVE")).toBe(false);
    expect(canTransitionSession("SCHEDULED", "ACTIVE")).toBe(false);
  });
  it("builds a newest-first timeline with labels", () => {
    const timeline = buildTimeline([
      { type: "SHIFT_STARTED", occurredAt: new Date(1000) },
      { type: "SHIFT_COMPLETED", occurredAt: new Date(3000), durationMinutes: 90 },
      { type: "SESSION_ATTENDED", occurredAt: new Date(2000), durationMinutes: 45 },
    ]);
    expect(timeline.map((t) => t.type)).toEqual([
      "SHIFT_COMPLETED",
      "SESSION_ATTENDED",
      "SHIFT_STARTED",
    ]);
    expect(timeline[0]!.label).toBe("Shift completed");
  });
});
