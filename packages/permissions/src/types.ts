import type { Action } from "./actions";

export type PermissionScope =
  | { type: "organization" }
  | { type: "department"; departmentId: string }
  | { type: "assigned_departments" }
  | { type: "own" }
  | { type: "below_rank" }
  | { type: "session"; sessionId: string }
  | { type: "cad_agency"; agencyId: string }
  | { type: "public" };

export type Actor = {
  userId: string;
  membershipId: string;
  organizationId: string;
  roleKeys: string[];
  permissionKeys: string[];
  departmentIds: string[];
  rankOrder?: number | null;
  isPlatformAdmin?: boolean;
  breakGlassUntil?: Date | null;
};

export type Resource = {
  type: string;
  id?: string;
  organizationId: string;
  departmentId?: string | null;
  ownerUserId?: string | null;
  ownerMembershipId?: string | null;
  rankOrder?: number | null;
  sessionId?: string | null;
  agencyId?: string | null;
  sensitivity?: "normal" | "sensitive" | "restricted";
};

export type AuthorizeInput = {
  actor: Actor;
  organizationId: string;
  action: Action;
  resource?: Resource;
  context?: {
    requireBreakGlass?: boolean;
    now?: Date;
  };
};

export type AuthorizationDecision = {
  allowed: boolean;
  reason: string;
  matchedGrants: string[];
  matchedRestrictions: string[];
};

export type PermissionGrant = {
  action: Action;
  scope: PermissionScope;
  source: string;
};

// Granular CAD/MDT v2 actions bundled for role assignment.
const CAD_V2_ALL: Action[] = [
  "cad.access",
  "cad.dispatch.view",
  "cad.dispatch.manage",
  "cad.calls.create",
  "cad.calls.assign",
  "cad.calls.close",
  "cad.units.manage",
  "cad.mdt.access",
  "cad.people.view",
  "cad.people.manage",
  "cad.vehicles.view",
  "cad.vehicles.manage",
  "cad.records.create",
  "cad.records.review",
  "cad.records.approve",
  "cad.records.lock",
  "cad.warrants.create",
  "cad.warrants.review",
  "cad.warrants.approve",
  "cad.bolos.manage",
  "cad.evidence.manage",
  "cad.court.access",
  "cad.fireems.access",
  "cad.civilian.access",
  "cad.analytics.view",
  "cad.configuration.manage",
];

// Line-officer subset: can operate the MDT and file records, but not manage
// configuration, approve records/warrants, or manage units.
const CAD_V2_OFFICER: Action[] = [
  "cad.access",
  "cad.dispatch.view",
  "cad.calls.create",
  "cad.calls.assign",
  "cad.mdt.access",
  "cad.people.view",
  "cad.vehicles.view",
  "cad.records.create",
  "cad.warrants.create",
  "cad.bolos.manage",
];

// Full scheduled-shift management (owners/admins).
const SHIFTS_ALL: Action[] = [
  "shifts.schedule",
  "shifts.schedule.recurring",
  "shifts.edit",
  "shifts.cancel",
  "shifts.claim",
  "shifts.claim.approve",
  "shifts.assign_host",
  "shifts.publish_discord",
  "shifts.start",
  "shifts.complete",
  "shifts.attendance.view",
  "shifts.attendance.manage",
  "shifts.attendance.override",
  "shifts.integration.manage",
  "shifts.analytics.view",
];

// Insights engine — viewing is broad; goals/alerts management is staff-level.
const INSIGHTS_VIEW: Action[] = [
  "insights.view",
  "kpis.view",
  "recommendations.view",
  "department.insights",
];
const INSIGHTS_MANAGE: Action[] = [...INSIGHTS_VIEW, "goals.manage", "alerts.manage"];

// Knowledge + AI — reading knowledge and using the assistant are broad;
// authoring/publishing is staff-level; provider admin is owner/admin.
const KNOWLEDGE_VIEW: Action[] = ["knowledge.view", "ai.use"];
const KNOWLEDGE_MANAGE: Action[] = [...KNOWLEDGE_VIEW, "knowledge.manage", "knowledge.publish"];
const AI_ADMIN: Action[] = ["ai.admin"];

// Enterprise RMS — officers get core records; owners/admins get every module.
const RMS_OFFICER: Action[] = [
  "rms.view",
  "cases.view",
  "cases.create",
  "cases.edit",
  "evidence.manage",
  "records.manage",
  "detective.manage",
];
const RMS_ALL: Action[] = [
  ...RMS_OFFICER,
  "cases.archive",
  "court.manage",
  "jail.manage",
  "internal_affairs.manage",
  "fleet.manage",
  "fire.manage",
  "ems.manage",
  "civilian_portal.manage",
];

// Full automation management (owners/admins).
const AUTOMATION_ALL: Action[] = [
  "automation.view",
  "automation.create",
  "automation.edit",
  "automation.delete",
  "automation.execute",
  "automation.pause",
  "automation.resume",
  "automation.logs",
  "automation.templates",
];

// What a staff host can do (claim, run, take attendance) — no scheduler/approval powers.
const SHIFTS_STAFF: Action[] = [
  "shifts.claim",
  "shifts.start",
  "shifts.complete",
  "shifts.attendance.view",
  "shifts.attendance.manage",
];

export const SYSTEM_ROLE_PERMISSIONS: Record<string, Action[]> = {
  owner: [
    "organization:read",
    "organization:update",
    "organization:delete",
    "organization:manage_billing",
    "organization:manage_modules",
    "organization:view_audit",
    "organization:export",
    "organization:manage_integrations",
    "member:read",
    "member:invite",
    "member:update",
    "member:remove",
    "member:view_sensitive",
    "role:read",
    "role:manage",
    "permission:simulate",
    "permission:grant",
    "permission:break_glass",
    "staff:read",
    "staff:manage",
    "staff:promote",
    "staff:view_reviews",
    "department:read",
    "department:manage",
    "department:manage_members",
    "shift:read",
    "shift:manage_own",
    "shift:manage_others",
    "activity:read",
    "activity:manage",
    "session:read",
    "session:manage",
    "session:launch",
    "announcement:read",
    "announcement:manage",
    "moderation:read",
    "moderation:create",
    "moderation:approve",
    "moderation:appeal",
    "application:read",
    "application:manage",
    "application:review",
    "training:read",
    "training:manage",
    "document:read",
    "document:manage",
    "document:publish",
    "cad:dispatch",
    "cad:unit",
    "cad:records",
    "cad:manage",
    ...CAD_V2_ALL,
    ...SHIFTS_ALL,
    ...AUTOMATION_ALL,
    ...INSIGHTS_MANAGE,
    ...KNOWLEDGE_MANAGE,
    ...RMS_ALL,
    ...AI_ADMIN,
    "erlc:view",
    "erlc:command",
    "erlc:manage",
  ],
  admin: [
    "organization:read",
    "organization:update",
    "organization:manage_modules",
    "organization:view_audit",
    "organization:export",
    "organization:manage_integrations",
    "member:read",
    "member:invite",
    "member:update",
    "member:remove",
    "member:view_sensitive",
    "role:read",
    "role:manage",
    "permission:simulate",
    "permission:grant",
    "staff:read",
    "staff:manage",
    "staff:promote",
    "staff:view_reviews",
    "department:read",
    "department:manage",
    "department:manage_members",
    "shift:read",
    "shift:manage_own",
    "shift:manage_others",
    "activity:read",
    "activity:manage",
    "session:read",
    "session:manage",
    "session:launch",
    "announcement:read",
    "announcement:manage",
    "moderation:read",
    "moderation:create",
    "moderation:approve",
    "application:read",
    "application:manage",
    "application:review",
    "training:read",
    "training:manage",
    "document:read",
    "document:manage",
    "document:publish",
    "cad:dispatch",
    "cad:unit",
    "cad:records",
    "cad:manage",
    ...CAD_V2_ALL,
    ...SHIFTS_ALL,
    ...AUTOMATION_ALL,
    ...INSIGHTS_MANAGE,
    ...KNOWLEDGE_MANAGE,
    ...RMS_ALL,
    ...AI_ADMIN,
    "erlc:view",
    "erlc:command",
    "erlc:manage",
  ],
  moderator: [
    "organization:read",
    "member:read",
    "staff:read",
    "department:read",
    "shift:read",
    "shift:manage_own",
    "session:read",
    "announcement:read",
    "moderation:read",
    "moderation:create",
    ...CAD_V2_OFFICER,
    ...SHIFTS_STAFF,
    ...INSIGHTS_VIEW,
    ...KNOWLEDGE_VIEW,
    ...RMS_OFFICER,
    "erlc:view",
    "document:read",
  ],
  staff: [
    "organization:read",
    "member:read",
    "staff:read",
    "department:read",
    "shift:read",
    "shift:manage_own",
    "activity:read",
    "session:read",
    "announcement:read",
    "training:read",
    "document:read",
    ...CAD_V2_OFFICER,
    ...SHIFTS_STAFF,
    ...INSIGHTS_VIEW,
    ...KNOWLEDGE_VIEW,
    ...RMS_OFFICER,
    "erlc:view",
  ],
  // Baseline members do NOT get CAD access — CAD (law-enforcement) records must be
  // granted explicitly via role/permission, never implied by community membership.
  member: ["organization:read", "member:read", "announcement:read", "document:read"],
};
