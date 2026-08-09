/**
 * Scheduled-shift domain — pure logic for the scheduled-shift extension of the
 * Operational Time Platform. Status lifecycle, eligibility, conflict detection,
 * safe Discord template rendering, PRC presence decisions, and recurrence
 * occurrence generation. No DB, no side effects.
 */

export const SCHEDULED_SHIFT_STATUSES = [
  "DRAFT",
  "OPEN_CLAIMING",
  "AWAITING_APPROVAL",
  "CLAIMED",
  "SCHEDULED",
  "PUBLISHED",
  "STARTING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "NO_HOST",
  "MISSED",
  "ARCHIVED",
] as const;
export type ScheduledShiftStatus = (typeof SCHEDULED_SHIFT_STATUSES)[number];

const TRANSITIONS: Record<ScheduledShiftStatus, ScheduledShiftStatus[]> = {
  DRAFT: ["OPEN_CLAIMING", "SCHEDULED", "CANCELLED", "ARCHIVED"],
  OPEN_CLAIMING: ["AWAITING_APPROVAL", "CLAIMED", "NO_HOST", "CANCELLED"],
  AWAITING_APPROVAL: ["CLAIMED", "OPEN_CLAIMING", "CANCELLED"],
  CLAIMED: ["SCHEDULED", "PUBLISHED", "OPEN_CLAIMING", "CANCELLED"],
  SCHEDULED: ["PUBLISHED", "OPEN_CLAIMING", "CANCELLED"],
  PUBLISHED: ["STARTING", "ACTIVE", "CANCELLED", "MISSED"],
  STARTING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  NO_HOST: ["OPEN_CLAIMING", "CANCELLED", "MISSED"],
  MISSED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionScheduledShift(
  from: ScheduledShiftStatus,
  to: ScheduledShiftStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type ClaimPolicy = "FIRST_ELIGIBLE" | "APPROVAL_REQUIRED" | "ASSIGNED_ONLY";
export type PrcSyncPolicy = "SUGGEST_ONLY" | "AUTO_PRESENT" | "AUTO_CHECKIN" | "DISABLED";

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export type EligibilityMember = {
  isActive: boolean;
  permissionKeys: string[];
  departmentIds: string[];
  rankOrder?: number | null;
};

export type EligibilityShift = {
  requiredPermission?: string | null;
  requiredDepartmentId?: string | null;
  minRankOrder?: number | null;
};

export type EligibilityResult = { eligible: boolean; reasons: string[] };

/** Server-side eligibility evaluation (pure). Conflicts are checked separately. */
export function evaluateEligibility(
  member: EligibilityMember,
  shift: EligibilityShift,
): EligibilityResult {
  const reasons: string[] = [];
  if (!member.isActive) reasons.push("Membership is not active");
  if (shift.requiredPermission && !member.permissionKeys.includes(shift.requiredPermission)) {
    reasons.push(`Missing required permission: ${shift.requiredPermission}`);
  }
  if (shift.requiredDepartmentId && !member.departmentIds.includes(shift.requiredDepartmentId)) {
    reasons.push("Not a member of the required department");
  }
  if (
    typeof shift.minRankOrder === "number" &&
    (typeof member.rankOrder !== "number" || member.rankOrder > shift.minRankOrder)
  ) {
    // Lower order = higher rank; must be at or above the minimum.
    reasons.push("Rank below the minimum required");
  }
  return { eligible: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

export type TimeWindow = { start: Date; end: Date };

export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/** Return the existing windows that overlap the candidate window. */
export function detectConflicts(candidate: TimeWindow, existing: TimeWindow[]): TimeWindow[] {
  return existing.filter((w) => windowsOverlap(candidate, w));
}

// ---------------------------------------------------------------------------
// Discord template rendering (safe variable substitution — no eval)
// ---------------------------------------------------------------------------

export const DISCORD_TEMPLATE_VARS = [
  "shift.title",
  "shift.department",
  "shift.start_time",
  "shift.end_time",
  "shift.timezone",
  "shift.host",
  "shift.co_hosts",
  "shift.server_name",
  "shift.description",
  "shift.staff_count",
  "shift.url",
] as const;

export const DEFAULT_ANNOUNCEMENT_TEMPLATE = [
  "**{{shift.title}}** — {{shift.department}}",
  "{{shift.start_time}} → {{shift.end_time}} ({{shift.timezone}})",
  "Host: {{shift.host}}   Co-hosts: {{shift.co_hosts}}",
  "Server: {{shift.server_name}}   Staffing: {{shift.staff_count}}",
  "{{shift.description}}",
  "Claim / details: {{shift.url}}",
].join("\n");

/**
 * Render an announcement template with a whitelisted value map. Only known
 * `{{shift.*}}` variables are substituted; anything else is left intact so no
 * arbitrary content or code can be injected through the template.
 */
export function renderAnnouncementTemplate(
  template: string,
  values: Partial<Record<(typeof DISCORD_TEMPLATE_VARS)[number], string>>,
): string {
  return template.replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (match, name: string) => {
    const key = name.trim() as (typeof DISCORD_TEMPLATE_VARS)[number];
    if (DISCORD_TEMPLATE_VARS.includes(key)) return values[key] ?? "";
    return match; // unknown variable: leave untouched, never evaluate
  });
}

// ---------------------------------------------------------------------------
// PRC presence → attendance decision
// ---------------------------------------------------------------------------

export type PrcDecision = "none" | "suggest" | "checkin" | "present";

export type PrcThresholds = {
  minPresenceMinutes: number; // ignore blips
};

/**
 * Decide the attendance action from PRC presence, per policy + safeguards. A
 * manual host decision always overrides this downstream.
 */
export function prcAttendanceDecision(
  policy: PrcSyncPolicy,
  presenceMinutes: number,
  thresholds: PrcThresholds = { minPresenceMinutes: 5 },
): PrcDecision {
  if (policy === "DISABLED") return "none";
  if (presenceMinutes < thresholds.minPresenceMinutes) {
    // Below the minimum meaningful duration -> never auto-present.
    return policy === "SUGGEST_ONLY" ? "none" : "none";
  }
  if (policy === "SUGGEST_ONLY") return "suggest";
  if (policy === "AUTO_CHECKIN") return "checkin";
  if (policy === "AUTO_PRESENT") return "present";
  return "none";
}

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

export type RecurrenceRule = {
  freq: "DAILY" | "WEEKLY";
  /** 0..6 (Sun..Sat), for WEEKLY. */
  weekdays?: number[];
  hour: number;
  minute: number;
};

/**
 * Generate occurrence start times within [from, until], bounded by `maxCount`.
 * DST is respected because dates are constructed in local components by the
 * caller's timezone-aware wrapper; here we operate on the provided Date range.
 */
export function generateOccurrences(
  rule: RecurrenceRule,
  from: Date,
  until: Date,
  maxCount = 60,
): Date[] {
  const out: Date[] = [];
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  let guard = 0;
  while (cursor.getTime() <= until.getTime() && out.length < maxCount && guard < 1000) {
    guard += 1;
    const matchesDay =
      rule.freq === "DAILY" || (rule.weekdays?.includes(cursor.getUTCDay()) ?? false);
    if (matchesDay) {
      const occ = new Date(cursor);
      occ.setUTCHours(rule.hour, rule.minute, 0, 0);
      if (occ.getTime() >= from.getTime() && occ.getTime() <= until.getTime()) {
        if (!out.some((d) => d.getTime() === occ.getTime())) out.push(occ);
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}
