/**
 * Enterprise RMS — pure domain. The RMS makes every operational object a
 * connected, timelined, relatable record. This module defines the record-type
 * registry, case + evidence lifecycles, an immutable chain-of-custody model, the
 * relationship-engine vocabulary, and the timeline engine helpers. All pure and
 * deterministic; the service layer persists + enforces permissions.
 */

// ---------------------------------------------------------------------------
// Record-type registry — every RMS module is a first-class record type. Some
// have concrete tables (case/evidence/person/vehicle/property); the rest share a
// generic record table but participate identically in relationships + timeline.
// ---------------------------------------------------------------------------

export type RecordCategory =
  | "case"
  | "evidence"
  | "people"
  | "property"
  | "vehicles"
  | "places"
  | "court"
  | "corrections"
  | "investigations"
  | "oversight"
  | "fleet"
  | "fire_ems";

export type RecordTypeDef = {
  type: string;
  label: string;
  category: RecordCategory;
  viewPermission: string;
  managePermission: string;
  /** Generic records live in the shared RmsRecord table. */
  generic: boolean;
  numberPrefix: string;
};

export const RMS_RECORD_TYPES: RecordTypeDef[] = [
  {
    type: "case",
    label: "Case",
    category: "case",
    viewPermission: "cases.view",
    managePermission: "cases.create",
    generic: false,
    numberPrefix: "CASE",
  },
  {
    type: "evidence",
    label: "Evidence",
    category: "evidence",
    viewPermission: "evidence.manage",
    managePermission: "evidence.manage",
    generic: false,
    numberPrefix: "EVD",
  },
  {
    type: "person",
    label: "Person",
    category: "people",
    viewPermission: "records.manage",
    managePermission: "records.manage",
    generic: false,
    numberPrefix: "PER",
  },
  {
    type: "vehicle",
    label: "Vehicle",
    category: "vehicles",
    viewPermission: "records.manage",
    managePermission: "records.manage",
    generic: false,
    numberPrefix: "VEH",
  },
  {
    type: "property",
    label: "Property",
    category: "property",
    viewPermission: "records.manage",
    managePermission: "records.manage",
    generic: false,
    numberPrefix: "PROP",
  },
  {
    type: "address",
    label: "Address",
    category: "places",
    viewPermission: "records.manage",
    managePermission: "records.manage",
    generic: true,
    numberPrefix: "ADR",
  },
  {
    type: "business",
    label: "Business",
    category: "places",
    viewPermission: "records.manage",
    managePermission: "records.manage",
    generic: true,
    numberPrefix: "BIZ",
  },
  {
    type: "court_case",
    label: "Court Case",
    category: "court",
    viewPermission: "court.manage",
    managePermission: "court.manage",
    generic: true,
    numberPrefix: "CRT",
  },
  {
    type: "jail_booking",
    label: "Jail Booking",
    category: "corrections",
    viewPermission: "jail.manage",
    managePermission: "jail.manage",
    generic: true,
    numberPrefix: "BKG",
  },
  {
    type: "detective_case",
    label: "Detective Case",
    category: "investigations",
    viewPermission: "detective.manage",
    managePermission: "detective.manage",
    generic: true,
    numberPrefix: "DET",
  },
  {
    type: "ia_complaint",
    label: "Internal Affairs Complaint",
    category: "oversight",
    viewPermission: "internal_affairs.manage",
    managePermission: "internal_affairs.manage",
    generic: true,
    numberPrefix: "IA",
  },
  {
    type: "fleet_vehicle",
    label: "Fleet Vehicle",
    category: "fleet",
    viewPermission: "fleet.manage",
    managePermission: "fleet.manage",
    generic: true,
    numberPrefix: "FLT",
  },
  {
    type: "fire_incident",
    label: "Fire Incident",
    category: "fire_ems",
    viewPermission: "fire.manage",
    managePermission: "fire.manage",
    generic: true,
    numberPrefix: "FIR",
  },
  {
    type: "ems_patient",
    label: "EMS Patient Care",
    category: "fire_ems",
    viewPermission: "ems.manage",
    managePermission: "ems.manage",
    generic: true,
    numberPrefix: "EMS",
  },
];

const RECORD_BY_TYPE = new Map(RMS_RECORD_TYPES.map((r) => [r.type, r]));
export function recordType(type: string): RecordTypeDef | undefined {
  return RECORD_BY_TYPE.get(type);
}
export function isRecordType(type: string): boolean {
  return RECORD_BY_TYPE.has(type);
}
export function formatRecordNumber(
  prefix: string,
  seq: number,
  year = new Date().getUTCFullYear(),
): string {
  return `${prefix}-${year}-${String(seq).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// Case lifecycle
// ---------------------------------------------------------------------------

export const CASE_STATUSES = [
  "OPEN",
  "ACTIVE",
  "PENDING",
  "AWAITING_EVIDENCE",
  "AWAITING_REVIEW",
  "AWAITING_COURT",
  "CLOSED",
  "ARCHIVED",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

const OPEN_STATES: CaseStatus[] = [
  "OPEN",
  "ACTIVE",
  "PENDING",
  "AWAITING_EVIDENCE",
  "AWAITING_REVIEW",
  "AWAITING_COURT",
];

export function isCaseOpen(status: CaseStatus): boolean {
  return OPEN_STATES.includes(status);
}

export function canTransitionCase(from: CaseStatus, to: CaseStatus): boolean {
  if (from === to) return false;
  if (from === "ARCHIVED") return false; // terminal
  if (from === "CLOSED") return to === "ARCHIVED" || to === "ACTIVE"; // reopen or archive
  // Any open state may move to any other open state, or be closed/archived.
  return true;
}

// ---------------------------------------------------------------------------
// Evidence lifecycle + immutable chain of custody
// ---------------------------------------------------------------------------

export const EVIDENCE_STATUSES = [
  "COLLECTED",
  "IN_STORAGE",
  "CHECKED_OUT",
  "RETURNED",
  "RELEASED",
  "ARCHIVED",
  "DESTROYED",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const CUSTODY_ACTIONS = [
  "COLLECT",
  "TRANSFER",
  "CHECK_OUT",
  "RETURN",
  "RELEASE",
  "ARCHIVE",
  "DESTROY",
] as const;
export type CustodyAction = (typeof CUSTODY_ACTIONS)[number];

const ACTION_STATUS: Record<CustodyAction, EvidenceStatus> = {
  COLLECT: "COLLECTED",
  TRANSFER: "IN_STORAGE",
  CHECK_OUT: "CHECKED_OUT",
  RETURN: "RETURNED",
  RELEASE: "RELEASED",
  ARCHIVE: "ARCHIVED",
  DESTROY: "DESTROYED",
};

export function statusAfterCustodyAction(action: CustodyAction): EvidenceStatus {
  return ACTION_STATUS[action];
}

/** Terminal evidence states can accept no further custody actions. */
export function canApplyCustodyAction(current: EvidenceStatus, action: CustodyAction): boolean {
  if (current === "DESTROYED" || current === "RELEASED") return false;
  if (action === "COLLECT") return false; // only at creation
  if (action === "CHECK_OUT" && current === "CHECKED_OUT") return false;
  if (action === "RETURN" && current !== "CHECKED_OUT") return false;
  return true;
}

export type CustodyEvent = {
  sequence: number;
  action: CustodyAction;
  fromUserId?: string | null;
  toUserId?: string | null;
  reason?: string | null;
  condition?: string | null;
  signature?: string | null;
  at: Date;
};

/**
 * Validate an evidence chain of custody. The chain must be append-only
 * (monotonic sequence + non-decreasing timestamps), begin with COLLECT, and
 * every TRANSFER/CHECK_OUT must record who it went to.
 */
export function validateCustodyChain(events: CustodyEvent[]): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (events.length === 0) return { valid: false, issues: ["Chain of custody is empty."] };
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence);
  if (sorted[0]!.action !== "COLLECT")
    issues.push("Chain of custody must begin with a COLLECT action.");
  for (let i = 0; i < sorted.length; i += 1) {
    const e = sorted[i]!;
    if (e.sequence !== i + 1) issues.push(`Sequence gap or reorder at position ${i + 1}.`);
    if (i > 0 && e.at.getTime() < sorted[i - 1]!.at.getTime())
      issues.push(`Timestamp goes backwards at sequence ${e.sequence}.`);
    if ((e.action === "TRANSFER" || e.action === "CHECK_OUT") && !e.toUserId)
      issues.push(`${e.action} at sequence ${e.sequence} is missing a recipient.`);
  }
  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Relationship engine vocabulary
// ---------------------------------------------------------------------------

export type RelationDef = { relation: string; label: string; inverse: string };

export const RELATIONS: RelationDef[] = [
  { relation: "related_to", label: "Related to", inverse: "Related to" },
  { relation: "involves", label: "Involves", inverse: "Involved in" },
  { relation: "owns", label: "Owns", inverse: "Owned by" },
  { relation: "suspect_in", label: "Suspect in", inverse: "Has suspect" },
  { relation: "victim_in", label: "Victim in", inverse: "Has victim" },
  { relation: "witness_in", label: "Witness in", inverse: "Has witness" },
  { relation: "evidence_for", label: "Evidence for", inverse: "Has evidence" },
  { relation: "located_at", label: "Located at", inverse: "Location of" },
  { relation: "registered_to", label: "Registered to", inverse: "Registered vehicle" },
  { relation: "charged_in", label: "Charged in", inverse: "Has charge" },
];

const RELATION_BY_KEY = new Map(RELATIONS.map((r) => [r.relation, r]));
export function relationLabel(relation: string, inverse = false): string {
  const def = RELATION_BY_KEY.get(relation);
  if (!def) return relation.replace(/_/g, " ");
  return inverse ? def.inverse : def.label;
}
export function isRelation(relation: string): boolean {
  return RELATION_BY_KEY.has(relation);
}

// ---------------------------------------------------------------------------
// Timeline engine
// ---------------------------------------------------------------------------

export const TIMELINE_EVENT_TYPES = [
  "created",
  "status_changed",
  "narrative_added",
  "note_added",
  "linked",
  "unlinked",
  "assigned",
  "evidence_collected",
  "custody_transfer",
  "closed",
  "reopened",
  "court_scheduled",
] as const;
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

export type TimelineEntry = {
  type: string;
  title: string;
  actorUserId?: string | null;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
};

/** Merge + order timeline entries chronologically (newest first). */
export function mergeTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}
