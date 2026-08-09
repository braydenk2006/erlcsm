import { describe, expect, it } from "vitest";
import {
  RMS_RECORD_TYPES,
  canApplyCustodyAction,
  canTransitionCase,
  formatRecordNumber,
  isCaseOpen,
  isRecordType,
  mergeTimeline,
  recordType,
  relationLabel,
  statusAfterCustodyAction,
  validateCustodyChain,
  type CustodyEvent,
} from "./index";

describe("record registry", () => {
  it("registers every module as a record type with permissions", () => {
    expect(isRecordType("case")).toBe(true);
    expect(isRecordType("court_case")).toBe(true);
    expect(isRecordType("nope")).toBe(false);
    expect(recordType("court_case")!.managePermission).toBe("court.manage");
    expect(recordType("case")!.generic).toBe(false);
    expect(recordType("jail_booking")!.generic).toBe(true);
    expect(new Set(RMS_RECORD_TYPES.map((r) => r.type)).size).toBe(RMS_RECORD_TYPES.length);
  });
  it("formats record numbers", () => {
    expect(formatRecordNumber("CASE", 123, 2026)).toBe("CASE-2026-000123");
  });
});

describe("case lifecycle", () => {
  it("classifies open vs closed and enforces transitions", () => {
    expect(isCaseOpen("ACTIVE")).toBe(true);
    expect(isCaseOpen("CLOSED")).toBe(false);
    expect(canTransitionCase("OPEN", "AWAITING_COURT")).toBe(true);
    expect(canTransitionCase("ARCHIVED", "OPEN")).toBe(false);
    expect(canTransitionCase("CLOSED", "ACTIVE")).toBe(true); // reopen
    expect(canTransitionCase("ACTIVE", "ACTIVE")).toBe(false);
  });
});

describe("evidence custody", () => {
  it("maps actions to resulting statuses", () => {
    expect(statusAfterCustodyAction("CHECK_OUT")).toBe("CHECKED_OUT");
    expect(statusAfterCustodyAction("DESTROY")).toBe("DESTROYED");
  });
  it("blocks illegal custody actions", () => {
    expect(canApplyCustodyAction("DESTROYED", "CHECK_OUT")).toBe(false);
    expect(canApplyCustodyAction("CHECKED_OUT", "CHECK_OUT")).toBe(false);
    expect(canApplyCustodyAction("IN_STORAGE", "RETURN")).toBe(false); // not checked out
    expect(canApplyCustodyAction("CHECKED_OUT", "RETURN")).toBe(true);
  });
  it("validates an append-only chain of custody", () => {
    const now = Date.now();
    const good: CustodyEvent[] = [
      { sequence: 1, action: "COLLECT", toUserId: "u1", at: new Date(now) },
      {
        sequence: 2,
        action: "CHECK_OUT",
        fromUserId: "u1",
        toUserId: "u2",
        at: new Date(now + 1000),
      },
      { sequence: 3, action: "RETURN", fromUserId: "u2", toUserId: "u1", at: new Date(now + 2000) },
    ];
    expect(validateCustodyChain(good).valid).toBe(true);
    // Not starting with COLLECT + missing recipient + backwards time
    const bad: CustodyEvent[] = [
      { sequence: 1, action: "CHECK_OUT", at: new Date(now + 5000) },
      { sequence: 2, action: "TRANSFER", at: new Date(now) },
    ];
    const res = validateCustodyChain(bad);
    expect(res.valid).toBe(false);
    expect(res.issues.length).toBeGreaterThanOrEqual(2);
  });
});

describe("relationship engine", () => {
  it("resolves relation labels + inverses", () => {
    expect(relationLabel("owns")).toBe("Owns");
    expect(relationLabel("owns", true)).toBe("Owned by");
    expect(relationLabel("custom_rel")).toBe("custom rel");
  });
});

describe("timeline engine", () => {
  it("merges entries newest-first", () => {
    const a = { type: "created", title: "a", occurredAt: new Date(1000) };
    const b = { type: "closed", title: "b", occurredAt: new Date(3000) };
    const c = { type: "note_added", title: "c", occurredAt: new Date(2000) };
    expect(mergeTimeline([a, b, c]).map((e) => e.title)).toEqual(["b", "c", "a"]);
  });
});
