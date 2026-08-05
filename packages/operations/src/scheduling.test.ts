import { describe, expect, it } from "vitest";
import {
  canTransitionScheduledShift,
  detectConflicts,
  evaluateEligibility,
  generateOccurrences,
  prcAttendanceDecision,
  renderAnnouncementTemplate,
  windowsOverlap,
  DEFAULT_ANNOUNCEMENT_TEMPLATE,
} from "./scheduling";

describe("scheduled shift lifecycle", () => {
  it("validates transitions", () => {
    expect(canTransitionScheduledShift("DRAFT", "OPEN_CLAIMING")).toBe(true);
    expect(canTransitionScheduledShift("CLAIMED", "PUBLISHED")).toBe(true);
    expect(canTransitionScheduledShift("ACTIVE", "COMPLETED")).toBe(true);
    expect(canTransitionScheduledShift("COMPLETED", "OPEN_CLAIMING")).toBe(false);
    expect(canTransitionScheduledShift("CANCELLED", "ACTIVE")).toBe(false);
    expect(canTransitionScheduledShift("DRAFT", "PUBLISHED")).toBe(false); // must claim/schedule first
  });
});

describe("eligibility", () => {
  const shift = {
    requiredPermission: "shifts.claim",
    requiredDepartmentId: "dept_a",
    minRankOrder: 3,
  };
  it("passes an eligible member", () => {
    const r = evaluateEligibility(
      { isActive: true, permissionKeys: ["shifts.claim"], departmentIds: ["dept_a"], rankOrder: 2 },
      shift,
    );
    expect(r.eligible).toBe(true);
  });
  it("fails an ineligible member with reasons", () => {
    const r = evaluateEligibility(
      { isActive: false, permissionKeys: [], departmentIds: [], rankOrder: 9 },
      shift,
    );
    expect(r.eligible).toBe(false);
    expect(r.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

describe("conflict detection", () => {
  it("detects overlapping windows", () => {
    const a = { start: new Date("2026-01-01T10:00Z"), end: new Date("2026-01-01T12:00Z") };
    const b = { start: new Date("2026-01-01T11:00Z"), end: new Date("2026-01-01T13:00Z") };
    const c = { start: new Date("2026-01-01T12:00Z"), end: new Date("2026-01-01T14:00Z") };
    expect(windowsOverlap(a, b)).toBe(true);
    expect(windowsOverlap(a, c)).toBe(false); // touching, not overlapping
    expect(detectConflicts(a, [b, c])).toHaveLength(1);
  });
});

describe("discord template rendering", () => {
  it("substitutes only whitelisted variables and ignores unknown ones", () => {
    const out = renderAnnouncementTemplate(
      "{{shift.title}} by {{shift.host}} — {{evil.exec}} {{shift.url}}",
      { "shift.title": "Patrol", "shift.host": "Alex", "shift.url": "http://x" },
    );
    expect(out).toContain("Patrol by Alex");
    expect(out).toContain("{{evil.exec}}"); // unknown var left untouched, never evaluated
    expect(out).toContain("http://x");
  });
  it("renders the default template", () => {
    const out = renderAnnouncementTemplate(DEFAULT_ANNOUNCEMENT_TEMPLATE, {
      "shift.title": "Morning Patrol",
    });
    expect(out).toContain("Morning Patrol");
  });
});

describe("prc attendance decision", () => {
  it("never auto-marks below the minimum presence duration", () => {
    expect(prcAttendanceDecision("AUTO_PRESENT", 1)).toBe("none");
    expect(prcAttendanceDecision("SUGGEST_ONLY", 1)).toBe("none");
  });
  it("applies the policy above the threshold", () => {
    expect(prcAttendanceDecision("SUGGEST_ONLY", 30)).toBe("suggest");
    expect(prcAttendanceDecision("AUTO_CHECKIN", 30)).toBe("checkin");
    expect(prcAttendanceDecision("AUTO_PRESENT", 30)).toBe("present");
    expect(prcAttendanceDecision("DISABLED", 30)).toBe("none");
  });
});

describe("recurrence", () => {
  it("generates weekly occurrences within a bounded horizon (no unbounded growth)", () => {
    const from = new Date("2026-01-05T00:00Z"); // Monday
    const until = new Date("2026-02-02T23:59Z");
    const occ = generateOccurrences(
      { freq: "WEEKLY", weekdays: [1], hour: 19, minute: 0 },
      from,
      until,
      60,
    );
    expect(occ.length).toBe(5); // 5 Mondays incl. bounds
    expect(occ.every((d) => d.getUTCDay() === 1 && d.getUTCHours() === 19)).toBe(true);
  });
  it("caps at maxCount", () => {
    const from = new Date("2026-01-01T00:00Z");
    const until = new Date("2027-01-01T00:00Z");
    const occ = generateOccurrences({ freq: "DAILY", hour: 8, minute: 0 }, from, until, 30);
    expect(occ.length).toBe(30);
  });
});
