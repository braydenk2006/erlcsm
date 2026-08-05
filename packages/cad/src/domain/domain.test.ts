import { describe, expect, it } from "vitest";
import {
  canTransitionCall,
  canTransitionReport,
  canTransitionUnit,
  canTransitionWarrant,
  formatCallNumber,
  isExpired,
  isReportEditable,
  isWarrantEnforceable,
  responseTimes,
} from "./index";

describe("unit status transitions", () => {
  it("allows PANIC from any status", () => {
    expect(canTransitionUnit("AVAILABLE", "PANIC")).toBe(true);
    expect(canTransitionUnit("OUT_OF_SERVICE", "PANIC")).toBe(true);
  });
  it("requires returning to AVAILABLE from OUT_OF_SERVICE", () => {
    expect(canTransitionUnit("OUT_OF_SERVICE", "AVAILABLE")).toBe(true);
    expect(canTransitionUnit("OUT_OF_SERVICE", "ON_SCENE")).toBe(false);
  });
});

describe("call status transitions", () => {
  it("permits the standard dispatch lifecycle", () => {
    expect(canTransitionCall("PENDING", "DISPATCHED")).toBe(true);
    expect(canTransitionCall("DISPATCHED", "ACTIVE")).toBe(true);
    expect(canTransitionCall("ACTIVE", "CLOSED")).toBe(true);
    expect(canTransitionCall("CLOSED", "PENDING")).toBe(true); // reopen
  });
  it("blocks illegal jumps", () => {
    expect(canTransitionCall("CLOSED", "ACTIVE")).toBe(false);
  });
});

describe("response times", () => {
  it("computes durations and ignores negative/missing", () => {
    const opened = new Date("2026-01-01T00:00:00Z");
    const times = responseTimes({
      openedAt: opened,
      dispatchedAt: new Date("2026-01-01T00:00:30Z"),
      onSceneAt: new Date("2026-01-01T00:03:00Z"),
      clearedAt: new Date("2026-01-01T00:10:00Z"),
    });
    expect(times.timeToDispatchMs).toBe(30_000);
    expect(times.timeToOnSceneMs).toBe(180_000);
    expect(times.totalMs).toBe(600_000);
    expect(times.timeToEnRouteMs).toBeNull();
  });
});

describe("call numbering", () => {
  it("formats a padded, year-prefixed number", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(formatCallNumber(1, {}, now)).toBe("2026-000001");
    expect(formatCallNumber(42, { prefix: "PD" }, now)).toBe("PD-2026-000042");
    expect(formatCallNumber(7, { includeYear: false, pad: 4 })).toBe("0007");
  });
});

describe("record + warrant workflows", () => {
  it("enforces record review lifecycle and edit-locking", () => {
    expect(canTransitionReport("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransitionReport("SUBMITTED", "APPROVED")).toBe(true);
    expect(canTransitionReport("APPROVED", "DRAFT")).toBe(false);
    expect(isReportEditable("DRAFT")).toBe(true);
    expect(isReportEditable("APPROVED")).toBe(false);
    expect(isReportEditable("LOCKED")).toBe(false);
  });
  it("requires approval before a warrant is enforceable", () => {
    expect(canTransitionWarrant("SUBMITTED", "ACTIVE")).toBe(false);
    expect(canTransitionWarrant("SUBMITTED", "APPROVED")).toBe(true);
    expect(canTransitionWarrant("APPROVED", "ACTIVE")).toBe(true);
    expect(isWarrantEnforceable("ACTIVE")).toBe(true);
    expect(isWarrantEnforceable("DRAFT")).toBe(false);
  });
});

describe("expiration", () => {
  it("detects expired items", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    expect(isExpired(new Date("2026-01-01T00:00:00Z"), now)).toBe(true);
    expect(isExpired(new Date("2026-01-03T00:00:00Z"), now)).toBe(false);
    expect(isExpired(null, now)).toBe(false);
  });
});
