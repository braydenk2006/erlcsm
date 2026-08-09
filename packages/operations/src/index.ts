/**
 * Operational Time Platform — shared domain.
 *
 * This is the single, pure calculation engine for member participation. Shifts,
 * sessions, attendance, activity, metrics, history, and analytics all derive
 * from ONE append-only ledger of participation events. No feature computes its
 * own activity/attendance/duration logic — they call these functions.
 */

// ---------------------------------------------------------------------------
// Participation events (the single source of truth)
// ---------------------------------------------------------------------------

export const PARTICIPATION_EVENT_TYPES = [
  "SHIFT_STARTED",
  "BREAK_STARTED",
  "BREAK_ENDED",
  "SHIFT_ENDED",
  "SHIFT_COMPLETED",
  "SESSION_SCHEDULED",
  "SESSION_OPENED",
  "SESSION_STARTED",
  "SESSION_COMPLETED",
  "SESSION_ATTENDED",
  "SESSION_HOSTED",
  "ATTENDANCE_RECORDED",
  "MANUAL_ADJUSTMENT",
] as const;

export type ParticipationEventType = (typeof PARTICIPATION_EVENT_TYPES)[number];

export type ParticipationCategory = "shift" | "session" | "attendance" | "manual";

type EventMeta = { category: ParticipationCategory; credit: boolean; label: string };

/**
 * `credit: true` means the event's `durationMinutes` contributes to a member's
 * total active time. Adding a future event source is a single entry here.
 */
export const EVENT_META: Record<ParticipationEventType, EventMeta> = {
  SHIFT_STARTED: { category: "shift", credit: false, label: "Shift started" },
  BREAK_STARTED: { category: "shift", credit: false, label: "Break started" },
  BREAK_ENDED: { category: "shift", credit: false, label: "Break ended" },
  SHIFT_ENDED: { category: "shift", credit: false, label: "Shift ended" },
  SHIFT_COMPLETED: { category: "shift", credit: true, label: "Shift completed" },
  SESSION_SCHEDULED: { category: "session", credit: false, label: "Session scheduled" },
  SESSION_OPENED: { category: "session", credit: false, label: "Session opened" },
  SESSION_STARTED: { category: "session", credit: false, label: "Session started" },
  SESSION_COMPLETED: { category: "session", credit: false, label: "Session completed" },
  SESSION_ATTENDED: { category: "session", credit: true, label: "Session attended" },
  SESSION_HOSTED: { category: "session", credit: false, label: "Session hosted" },
  ATTENDANCE_RECORDED: { category: "attendance", credit: false, label: "Attendance recorded" },
  MANUAL_ADJUSTMENT: { category: "manual", credit: true, label: "Manual adjustment" },
};

export function isCreditEvent(type: ParticipationEventType): boolean {
  return EVENT_META[type].credit;
}

// ---------------------------------------------------------------------------
// Shift + session + attendance status vocabularies
// ---------------------------------------------------------------------------

export const SHIFT_STATUSES = ["ACTIVE", "ON_BREAK", "COMPLETED", "CANCELLED"] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export const SESSION_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "OPEN",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const ATTENDANCE_STATUSES = [
  "REGISTERED",
  "PRESENT",
  "LATE",
  "EXCUSED",
  "LEFT_EARLY",
  "ABSENT",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Statuses that count as having attended (credit toward activity). */
export function attendedStatus(status: AttendanceStatus): boolean {
  return status === "PRESENT" || status === "LATE" || status === "LEFT_EARLY";
}

const SESSION_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  DRAFT: ["SCHEDULED", "OPEN", "CANCELLED"],
  SCHEDULED: ["OPEN", "CANCELLED"],
  OPEN: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionSession(from: SessionStatus, to: SessionStatus): boolean {
  return SESSION_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Pure time calculations
// ---------------------------------------------------------------------------

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000));
}

/** Active minutes of a shift = elapsed minus break minutes (never negative). */
export function computeActiveMinutes(startedAt: Date, endedAt: Date, breakMinutes: number): number {
  return Math.max(0, minutesBetween(startedAt, endedAt) - Math.max(0, breakMinutes));
}

// ---------------------------------------------------------------------------
// Metrics — derived entirely from participation events
// ---------------------------------------------------------------------------

export type ParticipationEventInput = {
  type: ParticipationEventType;
  durationMinutes?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type MemberMetrics = {
  totalActiveMinutes: number;
  shiftMinutes: number;
  breakMinutes: number;
  sessionMinutes: number;
  adjustmentMinutes: number;
  completedShifts: number;
  sessionsAttended: number;
  hostedSessions: number;
  avgShiftMinutes: number;
  avgSessionMinutes: number;
};

function metaNumber(metadata: Record<string, unknown> | null | undefined, key: string): number {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function computeMetrics(events: ParticipationEventInput[]): MemberMetrics {
  let shiftMinutes = 0;
  let breakMinutes = 0;
  let sessionMinutes = 0;
  let adjustmentMinutes = 0;
  let completedShifts = 0;
  let sessionsAttended = 0;
  let hostedSessions = 0;

  for (const event of events) {
    const duration = typeof event.durationMinutes === "number" ? event.durationMinutes : 0;
    switch (event.type) {
      case "SHIFT_COMPLETED":
        shiftMinutes += duration;
        breakMinutes += metaNumber(event.metadata, "breakMinutes");
        completedShifts += 1;
        break;
      case "SESSION_ATTENDED":
        sessionMinutes += duration;
        sessionsAttended += 1;
        break;
      case "SESSION_HOSTED":
        hostedSessions += 1;
        break;
      case "MANUAL_ADJUSTMENT":
        adjustmentMinutes += duration;
        break;
      default:
        break;
    }
  }

  const totalActiveMinutes = shiftMinutes + sessionMinutes + adjustmentMinutes;
  return {
    totalActiveMinutes,
    shiftMinutes,
    breakMinutes,
    sessionMinutes,
    adjustmentMinutes,
    completedShifts,
    sessionsAttended,
    hostedSessions,
    avgShiftMinutes: completedShifts > 0 ? Math.round(shiftMinutes / completedShifts) : 0,
    avgSessionMinutes: sessionsAttended > 0 ? Math.round(sessionMinutes / sessionsAttended) : 0,
  };
}

// ---------------------------------------------------------------------------
// Attendance statistics (reusable by sessions, training, meetings, …)
// ---------------------------------------------------------------------------

export type AttendanceStats = {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendanceRate: number; // 0..1 of registered who showed
  lateRate: number; // 0..1 of attendees who were late
};

export function computeAttendanceStats(statuses: AttendanceStatus[]): AttendanceStats {
  const total = statuses.length;
  const present = statuses.filter((s) => s === "PRESENT").length;
  const late = statuses.filter((s) => s === "LATE").length;
  const leftEarly = statuses.filter((s) => s === "LEFT_EARLY").length;
  const excused = statuses.filter((s) => s === "EXCUSED").length;
  const absent = statuses.filter((s) => s === "ABSENT").length;
  const attended = present + late + leftEarly;
  const eligible = total - excused;
  return {
    total,
    present: attended,
    late,
    absent,
    excused,
    attendanceRate: eligible > 0 ? attended / eligible : 0,
    lateRate: attended > 0 ? late / attended : 0,
  };
}

// ---------------------------------------------------------------------------
// Activity requirements / compliance
// ---------------------------------------------------------------------------

export type ComplianceStatus = "met" | "at_risk" | "below";

export function complianceStatus(
  activeMinutes: number,
  requiredMinutes: number,
  atRiskFraction = 0.75,
): ComplianceStatus {
  if (requiredMinutes <= 0) return "met";
  if (activeMinutes >= requiredMinutes) return "met";
  if (activeMinutes >= requiredMinutes * atRiskFraction) return "at_risk";
  return "below";
}

// ---------------------------------------------------------------------------
// History timeline
// ---------------------------------------------------------------------------

export type TimelineInput = {
  type: ParticipationEventType;
  occurredAt: Date;
  durationMinutes?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type TimelineEntry = {
  type: ParticipationEventType;
  category: ParticipationCategory;
  label: string;
  occurredAt: Date;
  durationMinutes: number | null;
};

/** One chronological operational history for a member (newest first). */
export function buildTimeline(events: TimelineInput[]): TimelineEntry[] {
  return [...events]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .map((event) => ({
      type: event.type,
      category: EVENT_META[event.type].category,
      label: EVENT_META[event.type].label,
      occurredAt: event.occurredAt,
      durationMinutes: typeof event.durationMinutes === "number" ? event.durationMinutes : null,
    }));
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export * from "./scheduling";
export * from "./presence";
