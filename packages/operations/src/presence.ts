/**
 * Verified private-server presence — pure interval math.
 *
 * Logged/activity minutes are derived ONLY from verified ER:LC private-server
 * presence intervals, computed server-side. Scheduled duration and attendance
 * status never award minutes. Durations are summed in exact seconds first, then
 * a display rounding policy is applied — individual intervals are never rounded
 * before summing.
 */

export type Interval = { start: Date; end: Date };

export type RoundingPolicy = "EXACT" | "ROUND_DOWN" | "NEAREST_5";

export type PresenceConfig = {
  /** Merge intervals separated by a gap no larger than this (documented reconnection tolerance). */
  reconnectionToleranceSeconds: number;
  /** Total presence below this is not counted at all. */
  minPresenceSeconds: number;
  /** Cap on countable minutes per shift (abuse prevention). */
  maxCountableMinutes: number;
  rounding: RoundingPolicy;
};

export const DEFAULT_PRESENCE_CONFIG: PresenceConfig = {
  reconnectionToleranceSeconds: 0,
  minPresenceSeconds: 60,
  maxCountableMinutes: 100000,
  rounding: "EXACT",
};

function ms(i: Interval): number {
  return Math.max(0, i.end.getTime() - i.start.getTime());
}

/**
 * Merge overlapping intervals (deduplicating duplicate join/leave) and, when a
 * gap is within the reconnection tolerance, join them. Always returns disjoint,
 * time-ordered intervals so overlapping time is never double-counted.
 */
export function normalizeIntervals(intervals: Interval[], toleranceSeconds = 0): Interval[] {
  const valid = intervals
    .filter((i) => i.end.getTime() > i.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Interval[] = [];
  const toleranceMs = Math.max(0, toleranceSeconds) * 1000;
  for (const i of valid) {
    const last = out[out.length - 1];
    if (last && i.start.getTime() <= last.end.getTime() + toleranceMs) {
      // Overlap or within-tolerance gap: extend, never duplicate.
      if (i.end.getTime() > last.end.getTime()) last.end = i.end;
    } else {
      out.push({ start: new Date(i.start), end: new Date(i.end) });
    }
  }
  return out;
}

/** Clip an interval to the allowed window; returns null when it falls outside. */
export function clampInterval(i: Interval, window: Interval): Interval | null {
  const start = Math.max(i.start.getTime(), window.start.getTime());
  const end = Math.min(i.end.getTime(), window.end.getTime());
  if (end <= start) return null;
  return { start: new Date(start), end: new Date(end) };
}

export function sumSeconds(intervals: Interval[]): number {
  return intervals.reduce((acc, i) => acc + ms(i) / 1000, 0);
}

/** Apply the display rounding policy to a precise second total → whole minutes. */
export function roundMinutes(totalSeconds: number, policy: RoundingPolicy): number {
  const minutes = totalSeconds / 60;
  switch (policy) {
    case "ROUND_DOWN":
      return Math.floor(minutes);
    case "NEAREST_5":
      return Math.round(minutes / 5) * 5;
    case "EXACT":
    default:
      return Math.round(minutes);
  }
}

export type LoggedMinutesResult = {
  rawSeconds: number; // exact, stored
  eligibleSeconds: number; // within window, after merge
  minutes: number; // display, after rounding + cap + min gate
  intervalsCounted: number;
};

/**
 * Compute verified logged minutes from raw presence intervals within the allowed
 * window. Sums exact seconds first, applies the reconnection tolerance, the
 * minimum-presence gate, the rounding policy, and the max cap — in that order.
 */
export function computeLoggedMinutes(input: {
  intervals: Interval[];
  window: Interval;
  config?: Partial<PresenceConfig>;
}): LoggedMinutesResult {
  const config = { ...DEFAULT_PRESENCE_CONFIG, ...(input.config ?? {}) };
  const normalized = normalizeIntervals(input.intervals, config.reconnectionToleranceSeconds);
  const rawSeconds = sumSeconds(normalized);
  const clamped = normalized
    .map((i) => clampInterval(i, input.window))
    .filter((i): i is Interval => i !== null);
  const eligibleSeconds = sumSeconds(clamped);

  if (eligibleSeconds < config.minPresenceSeconds) {
    return { rawSeconds, eligibleSeconds, minutes: 0, intervalsCounted: clamped.length };
  }
  const rounded = roundMinutes(eligibleSeconds, config.rounding);
  const minutes = Math.min(rounded, config.maxCountableMinutes);
  return { rawSeconds, eligibleSeconds, minutes, intervalsCounted: clamped.length };
}

/**
 * Build the allowed activity window from shift timing + grace configuration.
 * `windowMode` selects the counting start; the end is the actual completion when
 * available, otherwise the scheduled end plus the after-grace.
 */
export function buildActivityWindow(input: {
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date | null;
  actualEnd?: Date | null;
  graceBeforeMinutes: number;
  graceAfterMinutes: number;
  windowMode: "SCHEDULED_START" | "ACTUAL_START";
}): Interval {
  const startBase =
    input.windowMode === "ACTUAL_START" && input.actualStart
      ? input.actualStart
      : input.scheduledStart;
  const start = new Date(startBase.getTime() - input.graceBeforeMinutes * 60_000);
  const endBase =
    input.actualEnd ?? new Date(input.scheduledEnd.getTime() + input.graceAfterMinutes * 60_000);
  return { start, end: endBase };
}
