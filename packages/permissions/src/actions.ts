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

  // Announcements
  "announcement:read",
  "announcement:manage",

  // Scheduled shifts (Operational Time Platform)
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

  // Automation Platform
  "automation.view",
  "automation.create",
  "automation.edit",
  "automation.delete",
  "automation.execute",
  "automation.pause",
  "automation.resume",
  "automation.logs",
  "automation.templates",

  // Insights & Recommendations Engine
  "insights.view",
  "kpis.view",
  "recommendations.view",
  "goals.manage",
  "alerts.manage",
  "department.insights",

  // Knowledge Platform + AI Assistant
  "knowledge.view",
  "knowledge.manage",
  "knowledge.publish",
  "ai.use",
  "ai.admin",

  // Enterprise Records Management System (RMS)
  "rms.view",
  "cases.view",
  "cases.create",
  "cases.edit",
  "cases.archive",
  "evidence.manage",
  "records.manage",
  "court.manage",
  "jail.manage",
  "detective.manage",
  "internal_affairs.manage",
  "fleet.manage",
  "fire.manage",
  "ems.manage",
  "civilian_portal.manage",

  // Integration Hub
  "integrations.view",
  "integrations.manage",
  "integrations.credentials",
  "integrations.webhooks",
  "integrations.logs",
  "integrations.test",

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

  // CAD (legacy coarse actions — retained for backward compatibility)
  "cad:dispatch",
  "cad:unit",
  "cad:records",
  "cad:manage",

  // CAD/MDT v2 — granular, server-enforced actions
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
