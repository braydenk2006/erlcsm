import { describe, expect, it } from "vitest";
import {
  buildActivityWindow,
  clampInterval,
  computeLoggedMinutes,
  normalizeIntervals,
  roundMinutes,
  sumSeconds,
  type Interval,
} from "./presence";

const at = (iso: string) => new Date(`2026-01-01T${iso}Z`);
const iv = (a: string, b: string): Interval => ({ start: at(a), end: at(b) });

describe("presence interval normalization", () => {
  it("merges overlapping intervals (duplicate join) without double counting", () => {
    const n = normalizeIntervals([iv("18:00", "18:30"), iv("18:20", "18:40")]);
    expect(n).toHaveLength(1);
    expect(sumSeconds(n)).toBe(40 * 60);
  });
  it("keeps disjoint intervals separate (rejoin) and sums them", () => {
    const n = normalizeIntervals([iv("18:00", "18:30"), iv("18:35", "19:10")]);
    expect(n).toHaveLength(2);
    expect(sumSeconds(n)).toBe(65 * 60);
  });
  it("merges gaps within the reconnection tolerance", () => {
    const n = normalizeIntervals([iv("18:00", "18:30"), iv("18:34", "19:00")], 5 * 60);
    expect(n).toHaveLength(1);
  });
});

describe("window + verified minutes", () => {
  it("logs verified presence, not the full scheduled duration (86 not 120)", () => {
    // Shift 18:00-20:00; present 18:08-18:47 (39) + 18:55-19:42 (47) = 86.
    const result = computeLoggedMinutes({
      intervals: [iv("18:08", "18:47"), iv("18:55", "19:42")],
      window: iv("18:00", "20:00"),
    });
    expect(result.minutes).toBe(86);
  });
  it("clamps presence to the allowed window (before/after grace excluded)", () => {
    const clamped = clampInterval(iv("17:50", "18:20"), iv("18:00", "20:00"));
    expect(clamped && sumSeconds([clamped])).toBe(20 * 60);
    expect(clampInterval(iv("20:10", "20:40"), iv("18:00", "20:00"))).toBeNull();
  });
  it("late join yields fewer minutes than the shift", () => {
    // Join 10 min late, leave at end: 110 not 120.
    const r = computeLoggedMinutes({
      intervals: [iv("18:10", "20:00")],
      window: iv("18:00", "20:00"),
    });
    expect(r.minutes).toBe(110);
  });
});

describe("min presence + rounding + cap", () => {
  it("does not count presence below the minimum", () => {
    const r = computeLoggedMinutes({
      intervals: [iv("18:00", "18:00:30")],
      window: iv("18:00", "20:00"),
      config: { minPresenceSeconds: 60 },
    });
    expect(r.minutes).toBe(0);
  });
  it("stores exact seconds and rounds only for display", () => {
    // 90 seconds -> exact rounds to 2 min, round-down to 1 min; raw seconds preserved.
    const exact = computeLoggedMinutes({
      intervals: [iv("18:00", "18:01:30")],
      window: iv("18:00", "20:00"),
      config: { minPresenceSeconds: 0 },
    });
    expect(exact.eligibleSeconds).toBe(90);
    expect(exact.minutes).toBe(2);
    expect(roundMinutes(90, "ROUND_DOWN")).toBe(1);
    expect(roundMinutes(90, "NEAREST_5")).toBe(0);
  });
  it("caps at the maximum countable minutes", () => {
    const r = computeLoggedMinutes({
      intervals: [iv("18:00", "20:00")],
      window: iv("18:00", "22:00"),
      config: { maxCountableMinutes: 60 },
    });
    expect(r.minutes).toBe(60);
  });
});

describe("activity window construction", () => {
  it("uses actual completion as the end and applies grace", () => {
    const w = buildActivityWindow({
      scheduledStart: at("18:00"),
      scheduledEnd: at("20:00"),
      actualStart: at("18:05"),
      actualEnd: at("19:50"),
      graceBeforeMinutes: 15,
      graceAfterMinutes: 15,
      windowMode: "SCHEDULED_START",
    });
    expect(w.start).toEqual(at("17:45"));
    expect(w.end).toEqual(at("19:50"));
  });
});
