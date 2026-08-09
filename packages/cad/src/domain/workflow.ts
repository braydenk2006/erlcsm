// Records (reports/citations/arrests) review workflow.
export const REPORT_STATES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "REJECTED",
  "LOCKED",
  "ARCHIVED",
] as const;

export type ReportState = (typeof REPORT_STATES)[number];

const REPORT_TRANSITIONS: Record<ReportState, ReportState[]> = {
  DRAFT: ["SUBMITTED", "ARCHIVED"],
  SUBMITTED: ["UNDER_REVIEW", "REVISION_REQUESTED", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["REVISION_REQUESTED", "APPROVED", "REJECTED"],
  REVISION_REQUESTED: ["SUBMITTED", "ARCHIVED"],
  APPROVED: ["LOCKED", "ARCHIVED"],
  REJECTED: ["DRAFT", "ARCHIVED"],
  LOCKED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionReport(from: ReportState, to: ReportState): boolean {
  if (from === to) return false;
  return REPORT_TRANSITIONS[from].includes(to);
}

/** Approved or locked records must not be silently edited. */
export function isReportEditable(state: ReportState): boolean {
  return state === "DRAFT" || state === "REVISION_REQUESTED";
}

// Warrant approval workflow.
export const WARRANT_STATES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "DENIED",
  "ACTIVE",
  "SERVED",
  "EXPIRED",
  "RECALLED",
  "DISMISSED",
] as const;

export type WarrantState = (typeof WARRANT_STATES)[number];

const WARRANT_TRANSITIONS: Record<WarrantState, WarrantState[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "DENIED"],
  UNDER_REVIEW: ["APPROVED", "DENIED"],
  APPROVED: ["ACTIVE", "RECALLED"],
  DENIED: ["DRAFT"],
  ACTIVE: ["SERVED", "EXPIRED", "RECALLED", "DISMISSED"],
  SERVED: [],
  EXPIRED: [],
  RECALLED: [],
  DISMISSED: [],
};

export function canTransitionWarrant(from: WarrantState, to: WarrantState): boolean {
  if (from === to) return false;
  return WARRANT_TRANSITIONS[from].includes(to);
}

/** An issued/active warrant requires prior approval — AI/officers cannot skip review. */
export function isWarrantEnforceable(state: WarrantState): boolean {
  return state === "ACTIVE";
}
