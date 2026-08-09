/**
 * Automation Platform — domain.
 *
 * The event-driven backbone: standardized events flow onto one bus; automations
 * match a trigger, evaluate conditions (server-side), and run actions through a
 * durable queue. Every module publishes through the bus; none embed automation
 * logic. This file is pure (no DB/IO) so triggers/conditions/actions are testable
 * and reusable, and new packs plug into the registries.
 */

// ---------------------------------------------------------------------------
// Events + trigger registry
// ---------------------------------------------------------------------------

export const EVENT_TYPES = [
  "Organization.Created",
  "Member.Created",
  "Member.Promoted",
  "Member.Removed",
  "Department.Created",
  "Department.Updated",
  "Shift.Created",
  "Shift.Claimed",
  "Shift.Started",
  "Shift.Completed",
  "Attendance.Recorded",
  "Session.Completed",
  "Application.Submitted",
  "Application.Approved",
  "Application.Denied",
  "Workflow.StageChanged",
  "Workflow.Completed",
  "Training.Completed",
  "Announcement.Published",
  "Website.Published",
  "Server.PlayerJoined",
  "Server.PlayerLeft",
  "CAD.CallCreated",
  "CAD.ReportApproved",
  "Case.Created",
  "Case.Closed",
  "Evidence.Collected",
  "Evidence.CheckedOut",
  "Evidence.Returned",
  "Court.Scheduled",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type TriggerCategory =
  | "organizations"
  | "members"
  | "departments"
  | "applications"
  | "workflow"
  | "training"
  | "announcements"
  | "shifts"
  | "sessions"
  | "attendance"
  | "website"
  | "server"
  | "cad"
  | "rms";

/** Fields each event exposes to conditions/actions (`metadata.*`). */
export const TRIGGERS: Record<
  EventType,
  { category: TriggerCategory; label: string; fields: string[] }
> = {
  "Organization.Created": {
    category: "organizations",
    label: "Organization created",
    fields: ["name"],
  },
  "Member.Created": { category: "members", label: "Member joined", fields: ["roleKey", "email"] },
  "Member.Promoted": {
    category: "members",
    label: "Member promoted",
    fields: ["fromRank", "toRank"],
  },
  "Member.Removed": { category: "members", label: "Member removed", fields: [] },
  "Department.Created": { category: "departments", label: "Department created", fields: ["name"] },
  "Department.Updated": { category: "departments", label: "Department updated", fields: ["name"] },
  "Shift.Created": { category: "shifts", label: "Shift scheduled", fields: ["title", "shiftType"] },
  "Shift.Claimed": { category: "shifts", label: "Shift claimed", fields: ["title"] },
  "Shift.Started": { category: "shifts", label: "Shift started", fields: ["title"] },
  "Shift.Completed": {
    category: "shifts",
    label: "Shift completed",
    fields: ["title", "loggedMinutes"],
  },
  "Attendance.Recorded": {
    category: "attendance",
    label: "Attendance recorded",
    fields: ["status"],
  },
  "Session.Completed": { category: "sessions", label: "Session completed", fields: ["title"] },
  "Application.Submitted": {
    category: "applications",
    label: "Application submitted",
    fields: ["templateName"],
  },
  "Application.Approved": {
    category: "applications",
    label: "Application approved",
    fields: ["templateName", "category"],
  },
  "Application.Denied": {
    category: "applications",
    label: "Application denied",
    fields: ["templateName"],
  },
  "Workflow.StageChanged": {
    category: "workflow",
    label: "Workflow stage changed",
    fields: ["stageId"],
  },
  "Workflow.Completed": {
    category: "workflow",
    label: "Workflow completed",
    fields: ["category", "templateName"],
  },
  "Training.Completed": {
    category: "training",
    label: "Training completed",
    fields: ["templateName"],
  },
  "Announcement.Published": {
    category: "announcements",
    label: "Announcement published",
    fields: ["title"],
  },
  "Website.Published": { category: "website", label: "Website published", fields: [] },
  "Server.PlayerJoined": {
    category: "server",
    label: "Player joined server",
    fields: ["robloxUserId"],
  },
  "Server.PlayerLeft": {
    category: "server",
    label: "Player left server",
    fields: ["robloxUserId"],
  },
  "CAD.CallCreated": { category: "cad", label: "CAD call created", fields: ["priority"] },
  "CAD.ReportApproved": { category: "cad", label: "CAD report approved", fields: ["type"] },
  "Case.Created": { category: "rms", label: "RMS case created", fields: ["number", "title"] },
  "Case.Closed": { category: "rms", label: "RMS case closed", fields: ["number"] },
  "Evidence.Collected": {
    category: "rms",
    label: "Evidence collected",
    fields: ["number", "type"],
  },
  "Evidence.CheckedOut": { category: "rms", label: "Evidence checked out", fields: ["number"] },
  "Evidence.Returned": { category: "rms", label: "Evidence returned", fields: ["number"] },
  "Court.Scheduled": { category: "rms", label: "Court date scheduled", fields: ["number"] },
};

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

export type AutomationEvent = {
  type: EventType;
  organizationId: string;
  resourceId?: string | null;
  actorUserId?: string | null;
  occurredAt: Date;
  metadata: Record<string, unknown>;
  correlationId: string;
  version: number;
};

// ---------------------------------------------------------------------------
// Condition engine (server-side, AND/OR/nested/negation)
// ---------------------------------------------------------------------------

export const OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "in",
  "exists",
] as const;
export type Operator = (typeof OPERATORS)[number];

export type Condition = { field: string; op: Operator; value?: unknown };
export type ConditionGroup = {
  combinator: "AND" | "OR";
  negate?: boolean;
  conditions: (Condition | ConditionGroup)[];
};

function isGroup(c: Condition | ConditionGroup): c is ConditionGroup {
  return (c as ConditionGroup).combinator !== undefined;
}

/** Resolve `metadata.x` / bare field names from a flat + metadata context. */
function resolveField(field: string, context: Record<string, unknown>): unknown {
  if (field.startsWith("metadata.")) {
    const meta = (context.metadata as Record<string, unknown>) ?? {};
    return meta[field.slice("metadata.".length)];
  }
  if (field in context) return context[field];
  const meta = (context.metadata as Record<string, unknown>) ?? {};
  return meta[field];
}

function compare(actual: unknown, op: Operator, expected: unknown): boolean {
  switch (op) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "contains":
      if (Array.isArray(actual)) return actual.map(String).includes(String(expected));
      return String(actual ?? "").includes(String(expected));
    case "in":
      return Array.isArray(expected) && expected.map(String).includes(String(actual));
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    default:
      return false;
  }
}

export function evaluateConditions(
  group: ConditionGroup | null | undefined,
  context: Record<string, unknown>,
): boolean {
  if (!group || group.conditions.length === 0) return true;
  const results = group.conditions.map((c) =>
    isGroup(c)
      ? evaluateConditions(c, context)
      : compare(resolveField(c.field, context), c.op, c.value),
  );
  const combined = group.combinator === "AND" ? results.every(Boolean) : results.some(Boolean);
  return group.negate ? !combined : combined;
}

// ---------------------------------------------------------------------------
// Action registry
// ---------------------------------------------------------------------------

export const ACTION_TYPES = [
  "send_notification",
  "publish_announcement",
  "send_discord_message",
  "assign_department",
  "assign_member_role",
  "start_workflow",
  "create_task",
  "execute_server_command",
  "webhook",
  "http_request",
  "delay",
  "refresh_sitemap",
  "generate_report",
  // AI-ready (registered but not implemented this phase)
  "ai_summarize_report",
  "ai_score_application",
  "ai_generate_announcement",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTIONS: Record<
  ActionType,
  { label: string; category: string; aiReady: boolean; rollbackable: boolean }
> = {
  send_notification: {
    label: "Send notification",
    category: "notify",
    aiReady: false,
    rollbackable: false,
  },
  publish_announcement: {
    label: "Publish announcement",
    category: "content",
    aiReady: false,
    rollbackable: true,
  },
  send_discord_message: {
    label: "Send Discord message",
    category: "discord",
    aiReady: false,
    rollbackable: false,
  },
  assign_department: {
    label: "Assign department",
    category: "members",
    aiReady: false,
    rollbackable: true,
  },
  assign_member_role: {
    label: "Assign member role",
    category: "members",
    aiReady: false,
    rollbackable: true,
  },
  start_workflow: {
    label: "Start workflow",
    category: "workflow",
    aiReady: false,
    rollbackable: false,
  },
  create_task: { label: "Create task", category: "workflow", aiReady: false, rollbackable: true },
  execute_server_command: {
    label: "Execute server command",
    category: "server",
    aiReady: false,
    rollbackable: false,
  },
  webhook: { label: "Webhook", category: "integration", aiReady: false, rollbackable: false },
  http_request: {
    label: "HTTP request",
    category: "integration",
    aiReady: false,
    rollbackable: false,
  },
  delay: { label: "Delay", category: "control", aiReady: false, rollbackable: false },
  refresh_sitemap: {
    label: "Refresh sitemap",
    category: "website",
    aiReady: false,
    rollbackable: false,
  },
  generate_report: {
    label: "Generate report",
    category: "analytics",
    aiReady: false,
    rollbackable: false,
  },
  ai_summarize_report: {
    label: "AI: summarize report",
    category: "ai",
    aiReady: true,
    rollbackable: false,
  },
  ai_score_application: {
    label: "AI: score application",
    category: "ai",
    aiReady: true,
    rollbackable: false,
  },
  ai_generate_announcement: {
    label: "AI: generate announcement",
    category: "ai",
    aiReady: true,
    rollbackable: false,
  },
};

export type AutomationAction = { type: ActionType; config: Record<string, unknown> };

export function isActionType(value: string): value is ActionType {
  return (ACTION_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Execution + retry
// ---------------------------------------------------------------------------

export const RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "RETRYING",
  "CANCELLED",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const DEFAULT_MAX_ATTEMPTS = 3;

/** Exponential backoff with cap (ms). */
export function nextRetryDelayMs(attempt: number, baseMs = 1000, capMs = 60_000): number {
  return Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));
}

export function shouldRetry(attempt: number, maxAttempts = DEFAULT_MAX_ATTEMPTS): boolean {
  return attempt < maxAttempts;
}

export * from "./templates";
