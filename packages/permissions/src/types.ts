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
    "moderation:read",
    "moderation:create",
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
    "training:read",
    "document:read",
    "erlc:view",
  ],
  member: ["organization:read", "member:read", "document:read"],
};
