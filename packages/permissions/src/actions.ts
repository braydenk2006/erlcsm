export const ACTIONS = [
  // Organization
  "organization:read",
  "organization:update",
  "organization:delete",
  "organization:manage_billing",
  "organization:manage_modules",
  "organization:view_audit",
  "organization:export",
  "organization:manage_integrations",

  // Members
  "member:read",
  "member:invite",
  "member:update",
  "member:remove",
  "member:view_sensitive",

  // Roles & permissions
  "role:read",
  "role:manage",
  "permission:simulate",
  "permission:grant",
  "permission:break_glass",

  // Staff
  "staff:read",
  "staff:manage",
  "staff:promote",
  "staff:view_reviews",

  // Departments
  "department:read",
  "department:manage",
  "department:manage_members",

  // Shifts / activity / sessions
  "shift:read",
  "shift:manage_own",
  "shift:manage_others",
  "activity:read",
  "activity:manage",
  "session:read",
  "session:manage",
  "session:launch",

  // Moderation
  "moderation:read",
  "moderation:create",
  "moderation:approve",
  "moderation:appeal",

  // Applications / training / documents
  "application:read",
  "application:manage",
  "application:review",
  "training:read",
  "training:manage",
  "document:read",
  "document:manage",
  "document:publish",

  // CAD
  "cad:dispatch",
  "cad:unit",
  "cad:records",
  "cad:manage",

  // Live server / ER:LC
  "erlc:view",
  "erlc:command",
  "erlc:manage",

  // Platform
  "platform:admin",
  "platform:support_access",
] as const;

export type Action = (typeof ACTIONS)[number];

export function isAction(value: string): value is Action {
  return (ACTIONS as readonly string[]).includes(value);
}
