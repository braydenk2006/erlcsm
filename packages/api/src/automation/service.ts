import { randomUUID } from "node:crypto";
import { recordAuditEvent } from "@commandry/audit";
import {
  ACTIONS,
  AUTOMATION_TEMPLATES,
  DEFAULT_MAX_ATTEMPTS,
  evaluateConditions,
  isEventType,
  nextRetryDelayMs,
  shouldRetry,
  type AutomationAction,
  type AutomationEvent,
  type ConditionGroup,
  type EventType,
} from "@commandry/automation";
import { prisma } from "@commandry/database";
import {
  getDiscordClientForOrganization,
  getErlcClientForOrganization,
} from "@commandry/integrations";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";
import { notifyUsers } from "../notifications/service";
import { enqueueWebhookDeliveries } from "../integrations/webhooks";

function requirePerm(actor: Actor, organizationId: string, action: Action): void {
  if (!authorize({ actor, organizationId, action }).allowed)
    throw new ForbiddenError("Not permitted");
}

// ---------------------------------------------------------------------------
// Event bus — the single publish entry point every module calls
// ---------------------------------------------------------------------------

/**
 * Publish a standardized event onto the bus. Persists the immutable event, then
 * matches enabled automations by trigger, evaluates their conditions
 * server-side, and creates QUEUED runs (idempotent per automation+correlation).
 * Execution happens on the durable queue (worker), never inline.
 */
export async function publishEvent(input: {
  type: EventType | string;
  organizationId: string;
  resourceId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}): Promise<{ queued: number }> {
  if (!isEventType(input.type)) return { queued: 0 };
  const correlationId = input.correlationId ?? randomUUID();
  const event: AutomationEvent = {
    type: input.type,
    organizationId: input.organizationId,
    resourceId: input.resourceId ?? null,
    actorUserId: input.actorUserId ?? null,
    occurredAt: new Date(),
    metadata: input.metadata ?? {},
    correlationId,
    version: 1,
  };

  await prisma.automationEventLog
    .create({
      data: {
        publicId: createPublicId("evt"),
        organizationId: event.organizationId,
        type: event.type,
        resourceId: event.resourceId,
        actorUserId: event.actorUserId,
        correlationId,
        metadata: event.metadata as object,
        version: event.version,
      },
    })
    .catch(() => undefined);

  const automations = await prisma.automation.findMany({
    where: { organizationId: input.organizationId, trigger: event.type, enabled: true },
  });

  // Fan the event out to subscribed outgoing webhook endpoints (Integration Hub).
  await enqueueWebhookDeliveries({
    type: event.type,
    organizationId: event.organizationId,
    resourceId: event.resourceId,
    correlationId,
    metadata: event.metadata,
  }).catch(() => undefined);

  const context = { ...event, metadata: event.metadata } as unknown as Record<string, unknown>;
  let queued = 0;
  for (const automation of automations) {
    if (!evaluateConditions(automation.conditions as ConditionGroup, context)) continue;
    try {
      await prisma.automationRun.create({
        data: {
          publicId: createPublicId("run"),
          organizationId: input.organizationId,
          automationId: automation.id,
          eventType: event.type,
          correlationId,
          status: "QUEUED",
          eventPayload: { ...event, occurredAt: event.occurredAt.toISOString() } as object,
        },
      });
      queued += 1;
    } catch {
      // Unique (automationId, correlationId) => already queued for this event. Idempotent.
    }
  }
  return { queued };
}

// ---------------------------------------------------------------------------
// Action engine — reuses existing Ordinex services
// ---------------------------------------------------------------------------

type LogEntry = { action: string; ok: boolean; detail: string; at: string };

async function executeAction(
  organizationId: string,
  action: AutomationAction,
  event: AutomationEvent,
): Promise<LogEntry> {
  const at = new Date().toISOString();
  const meta = event.metadata as Record<string, unknown>;
  const cfg = action.config ?? {};
  const titleFromMeta =
    typeof cfg.fromMetadata === "string" ? String(meta[cfg.fromMetadata] ?? "") : "";
  const title = (typeof cfg.title === "string" ? cfg.title : "") || titleFromMeta || "Ordinex";
  const body = typeof cfg.body === "string" ? cfg.body : undefined;

  switch (action.type) {
    case "send_notification": {
      const userIds = new Set<string>();
      if (cfg.toActor && event.actorUserId) userIds.add(event.actorUserId);
      if (cfg.allMembers) {
        const members = await prisma.membership.findMany({
          where: { organizationId, status: "ACTIVE" },
          select: { userId: true },
        });
        members.forEach((m) => userIds.add(m.userId));
      }
      if (Array.isArray(cfg.roleKeys) && cfg.roleKeys.length) {
        const members = await prisma.membership.findMany({
          where: {
            organizationId,
            status: "ACTIVE",
            roles: { some: { role: { key: { in: cfg.roleKeys as string[] } } } },
          },
          select: { userId: true },
        });
        members.forEach((m) => userIds.add(m.userId));
      }
      await notifyUsers({
        organizationId,
        userIds: [...userIds],
        type: "automation",
        title,
        body,
        dedupeKey: `automation:${event.correlationId}:${action.type}`,
      });
      return { action: action.type, ok: true, detail: `notified ${userIds.size}`, at };
    }
    case "execute_server_command": {
      const command = typeof cfg.command === "string" ? cfg.command : "";
      if (!command) throw new Error("missing command");
      const { client } = await getErlcClientForOrganization(organizationId);
      await client.runCommand(command);
      return { action: action.type, ok: true, detail: `ran ${command}`, at };
    }
    case "send_discord_message": {
      // Reuse the existing Discord bot service — do not duplicate Discord logic.
      const content = (typeof cfg.message === "string" ? cfg.message : "") || title;
      const channelId = typeof cfg.channelId === "string" ? cfg.channelId : "announcements";
      const discord = await getDiscordClientForOrganization(organizationId);
      await discord.postAnnouncement(channelId, content);
      return { action: action.type, ok: true, detail: `discord (${discord.mode})`, at };
    }
    case "assign_department": {
      const departmentId = typeof cfg.departmentId === "string" ? cfg.departmentId : "";
      if (!departmentId || !event.actorUserId) throw new Error("missing departmentId/actor");
      const membership = await prisma.membership.findFirst({
        where: { organizationId, userId: event.actorUserId },
      });
      if (!membership) throw new Error("member not found");
      await prisma.departmentMember.upsert({
        where: { departmentId_membershipId: { departmentId, membershipId: membership.id } },
        create: { departmentId, membershipId: membership.id },
        update: {},
      });
      return { action: action.type, ok: true, detail: "assigned department", at };
    }
    case "webhook":
    case "http_request": {
      const url = typeof cfg.url === "string" ? cfg.url : "";
      if (!url) throw new Error("missing url");
      const res = await fetch(url, {
        method: typeof cfg.method === "string" ? cfg.method : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: event.type,
          correlationId: event.correlationId,
          metadata: meta,
        }),
      });
      if (!res.ok) throw new Error(`webhook ${res.status}`);
      return { action: action.type, ok: true, detail: `${res.status}`, at };
    }
    case "delay":
      return { action: action.type, ok: true, detail: "delay noted", at };
    case "refresh_sitemap":
      return { action: action.type, ok: true, detail: "sitemap refresh scheduled", at };
    case "create_task":
      return { action: action.type, ok: true, detail: `task: ${title}`, at };
    default:
      // AI + not-yet-implemented actions are recorded, not failed (AI-ready).
      return {
        action: action.type,
        ok: true,
        detail: `${ACTIONS[action.type]?.aiReady ? "ai not configured" : "noop"}`,
        at,
      };
  }
}

/**
 * Execute one automation run (idempotent). Runs actions sequentially; on failure
 * schedules a retry with exponential backoff, or dead-letters after max attempts.
 */
export async function runAutomation(runId: string): Promise<{ status: string }> {
  const run = await prisma.automationRun.findUnique({
    where: { id: runId },
    include: { automation: true },
  });
  if (!run) return { status: "MISSING" };
  if (["COMPLETED", "CANCELLED"].includes(run.status)) return { status: run.status };

  await prisma.automationRun.update({
    where: { id: run.id },
    data: {
      status: "RUNNING",
      startedAt: run.startedAt ?? new Date(),
      attempts: { increment: 1 },
      nextRetryAt: null,
    },
  });

  const payload = run.eventPayload as unknown as AutomationEvent & { occurredAt: string };
  const event: AutomationEvent = { ...payload, occurredAt: new Date(payload.occurredAt) };
  const actions = (run.automation.actions as AutomationAction[]) ?? [];
  const log: LogEntry[] = (run.log as LogEntry[]) ?? [];

  try {
    for (const action of actions) {
      const entry = await executeAction(run.organizationId, action, event);
      log.push(entry);
    }
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", finishedAt: new Date(), log: log as object, error: null },
    });
    return { status: "COMPLETED" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    log.push({ action: "error", ok: false, detail: message, at: new Date().toISOString() });
    const attempts = run.attempts + 1;
    if (shouldRetry(attempts, DEFAULT_MAX_ATTEMPTS)) {
      await prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: "RETRYING",
          error: message,
          log: log as object,
          nextRetryAt: new Date(Date.now() + nextRetryDelayMs(attempts)),
        },
      });
      return { status: "RETRYING" };
    }
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message, log: log as object },
    });
    return { status: "FAILED" };
  }
}

/** Worker entry point: process due QUEUED/RETRYING runs. Returns how many ran. */
export async function processQueuedRuns(
  limit = 25,
  now = new Date(),
): Promise<{ processed: number }> {
  const due = await prisma.automationRun.findMany({
    where: {
      OR: [{ status: "QUEUED" }, { status: "RETRYING", nextRetryAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const run of due) {
    await runAutomation(run.id).catch(() => undefined);
  }
  return { processed: due.length };
}

// ---------------------------------------------------------------------------
// CRUD + templates + analytics
// ---------------------------------------------------------------------------

export type AutomationView = {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  enabled: boolean;
  isBuiltIn: boolean;
  conditions: ConditionGroup;
  actions: AutomationAction[];
};

function toView(a: {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  enabled: boolean;
  isBuiltIn: boolean;
  conditions: unknown;
  actions: unknown;
}): AutomationView {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    trigger: a.trigger,
    enabled: a.enabled,
    isBuiltIn: a.isBuiltIn,
    conditions: (a.conditions as ConditionGroup) ?? { combinator: "AND", conditions: [] },
    actions: (a.actions as AutomationAction[]) ?? [],
  };
}

/** Seed the built-in automation templates (disabled) so users can enable them. */
export async function ensureBuiltInAutomations(organizationId: string): Promise<void> {
  for (const t of AUTOMATION_TEMPLATES) {
    const existing = await prisma.automation.findFirst({
      where: { organizationId, name: t.name, isBuiltIn: true },
    });
    if (existing) continue;
    await prisma.automation.create({
      data: {
        publicId: createPublicId("auto"),
        organizationId,
        name: t.name,
        description: t.description,
        trigger: t.trigger,
        conditions: t.conditions as object,
        actions: t.actions as unknown as object,
        enabled: false,
        isBuiltIn: true,
      },
    });
  }
}

export async function listAutomations(input: {
  actor: Actor;
  organizationId: string;
}): Promise<AutomationView[]> {
  requirePerm(input.actor, input.organizationId, "automation.view");
  await ensureBuiltInAutomations(input.organizationId);
  const rows = await prisma.automation.findMany({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toView);
}

export async function createAutomation(input: {
  actor: Actor;
  organizationId: string;
  name: string;
  trigger: string;
  conditions?: ConditionGroup;
  actions: AutomationAction[];
  description?: string;
}): Promise<AutomationView> {
  requirePerm(input.actor, input.organizationId, "automation.create");
  if (!isEventType(input.trigger)) throw new ValidationError("Unknown trigger");
  if (input.name.trim().length < 2) throw new ValidationError("Name is too short");
  const created = await prisma.automation.create({
    data: {
      publicId: createPublicId("auto"),
      organizationId: input.organizationId,
      name: input.name.trim(),
      description: input.description ?? null,
      trigger: input.trigger,
      conditions: (input.conditions ?? { combinator: "AND", conditions: [] }) as object,
      actions: input.actions as unknown as object,
      enabled: true,
      createdByUserId: input.actor.userId,
    },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "automation.create",
    resourceType: "automation",
    resourceId: created.id,
    source: "WEB",
    metadata: { trigger: input.trigger },
  }).catch(() => undefined);
  return toView(created);
}

export async function setAutomationEnabled(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  enabled: boolean;
}): Promise<void> {
  requirePerm(
    input.actor,
    input.organizationId,
    input.enabled ? "automation.resume" : "automation.pause",
  );
  const a = await prisma.automation.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!a) throw new NotFoundError("Automation not found");
  await prisma.automation.update({ where: { id: a.id }, data: { enabled: input.enabled } });
}

export async function deleteAutomation(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "automation.delete");
  const a = await prisma.automation.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!a) throw new NotFoundError("Automation not found");
  if (a.isBuiltIn)
    throw new ValidationError("Built-in automations can be disabled but not deleted");
  await prisma.automation.delete({ where: { id: a.id } });
}

export type RunView = {
  id: string;
  automationName: string;
  eventType: string;
  status: string;
  attempts: number;
  error: string | null;
  createdAt: string;
};

export async function listRuns(input: {
  actor: Actor;
  organizationId: string;
  automationId?: string;
}): Promise<RunView[]> {
  requirePerm(input.actor, input.organizationId, "automation.logs");
  const runs = await prisma.automationRun.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.automationId ? { automationId: input.automationId } : {}),
    },
    include: { automation: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return runs.map((r) => ({
    id: r.id,
    automationName: r.automation.name,
    eventType: r.eventType,
    status: r.status,
    attempts: r.attempts,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
  }));
}

export type AutomationAnalytics = {
  totalRuns: number;
  byStatus: Record<string, number>;
  successRate: number;
  avgDurationMs: number;
  topTriggers: { trigger: string; count: number }[];
  enabledAutomations: number;
};

export async function getAutomationAnalytics(input: {
  actor: Actor;
  organizationId: string;
}): Promise<AutomationAnalytics> {
  requirePerm(input.actor, input.organizationId, "automation.view");
  const runs = await prisma.automationRun.findMany({
    where: { organizationId: input.organizationId },
  });
  const byStatus: Record<string, number> = {};
  const triggers: Record<string, number> = {};
  let done = 0;
  let completed = 0;
  let durationMs = 0;
  for (const r of runs) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    triggers[r.eventType] = (triggers[r.eventType] ?? 0) + 1;
    if (r.status === "COMPLETED" || r.status === "FAILED") done += 1;
    if (r.status === "COMPLETED") {
      completed += 1;
      if (r.startedAt && r.finishedAt) durationMs += r.finishedAt.getTime() - r.startedAt.getTime();
    }
  }
  const enabledAutomations = await prisma.automation.count({
    where: { organizationId: input.organizationId, enabled: true },
  });
  return {
    totalRuns: runs.length,
    byStatus,
    successRate: done > 0 ? completed / done : 0,
    avgDurationMs: completed > 0 ? Math.round(durationMs / completed) : 0,
    topTriggers: Object.entries(triggers)
      .map(([trigger, count]) => ({ trigger, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    enabledAutomations,
  };
}
