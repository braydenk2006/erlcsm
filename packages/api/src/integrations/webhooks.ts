import { recordAuditEvent } from "@commandry/audit";
import { prisma, decryptSecret, encryptSecret } from "@commandry/database";
import {
  WEBHOOK_MAX_ATTEMPTS,
  generateWebhookSecret,
  isSafeWebhookUrl,
  signWebhookPayload,
  webhookBackoffMs,
} from "@commandry/integrations";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";

function requirePerm(actor: Actor, organizationId: string, action: Action): void {
  if (!authorize({ actor, organizationId, action }).allowed)
    throw new ForbiddenError("Not permitted");
}

export type WebhookView = {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  status: string;
  secretPrefix: string;
  consecutiveFailures: number;
  lastDeliveryAt: string | null;
  disabledReason: string | null;
  createdAt: string;
};

function toView(w: {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  status: string;
  secretPrefix: string;
  consecutiveFailures: number;
  lastDeliveryAt: Date | null;
  disabledReason: string | null;
  createdAt: Date;
}): WebhookView {
  return {
    id: w.id,
    name: w.name,
    url: w.url,
    events: w.events,
    enabled: w.enabled,
    status: w.status,
    secretPrefix: w.secretPrefix,
    consecutiveFailures: w.consecutiveFailures,
    lastDeliveryAt: w.lastDeliveryAt?.toISOString() ?? null,
    disabledReason: w.disabledReason,
    createdAt: w.createdAt.toISOString(),
  };
}

export async function listWebhooks(input: {
  actor: Actor;
  organizationId: string;
}): Promise<WebhookView[]> {
  requirePerm(input.actor, input.organizationId, "integrations.webhooks");
  const rows = await prisma.webhookEndpoint.findMany({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toView);
}

/** Create a webhook endpoint. Returns the signing secret ONCE — it is never returned again. */
export async function createWebhook(input: {
  actor: Actor;
  organizationId: string;
  name: string;
  url: string;
  events: string[];
}): Promise<{ webhook: WebhookView; secret: string }> {
  requirePerm(input.actor, input.organizationId, "integrations.webhooks");
  if (input.name.trim().length < 2) throw new ValidationError("Name too short");
  const safe = isSafeWebhookUrl(input.url);
  if (!safe.ok) throw new ValidationError(safe.reason ?? "Invalid webhook URL");
  if (input.events.length === 0) throw new ValidationError("Subscribe to at least one event");
  const secret = generateWebhookSecret();
  const enc = encryptSecret(secret);
  const created = await prisma.webhookEndpoint.create({
    data: {
      publicId: createPublicId("wh"),
      organizationId: input.organizationId,
      name: input.name.trim(),
      url: input.url,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
      secretPrefix: secret.slice(0, 12),
      events: input.events,
      createdByUserId: input.actor.userId,
    },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "integration.webhook.create",
    resourceType: "webhook_endpoint",
    resourceId: created.id,
    source: "WEB",
    metadata: { url: input.url, events: input.events },
  }).catch(() => undefined);
  return { webhook: toView(created), secret };
}

export async function rotateWebhookSecret(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<{ secret: string }> {
  requirePerm(input.actor, input.organizationId, "integrations.webhooks");
  const wh = await prisma.webhookEndpoint.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!wh) throw new NotFoundError("Webhook not found");
  const secret = generateWebhookSecret();
  const enc = encryptSecret(secret);
  await prisma.webhookEndpoint.update({
    where: { id: wh.id },
    data: {
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
      secretPrefix: secret.slice(0, 12),
    },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "integration.webhook.rotate",
    resourceType: "webhook_endpoint",
    resourceId: wh.id,
    source: "WEB",
  }).catch(() => undefined);
  return { secret };
}

export async function setWebhookEnabled(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  enabled: boolean;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "integrations.webhooks");
  const wh = await prisma.webhookEndpoint.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!wh) throw new NotFoundError("Webhook not found");
  await prisma.webhookEndpoint.update({
    where: { id: wh.id },
    data: {
      enabled: input.enabled,
      ...(input.enabled ? { status: "active", consecutiveFailures: 0, disabledReason: null } : {}),
    },
  });
}

export async function deleteWebhook(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<void> {
  requirePerm(input.actor, input.organizationId, "integrations.webhooks");
  const wh = await prisma.webhookEndpoint.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!wh) throw new NotFoundError("Webhook not found");
  await prisma.webhookEndpoint.delete({ where: { id: wh.id } });
}

export type DeliveryView = {
  id: string;
  eventType: string;
  status: string;
  httpStatus: number | null;
  durationMs: number | null;
  attempts: number;
  error: string | null;
  createdAt: string;
};

export async function listWebhookDeliveries(input: {
  actor: Actor;
  organizationId: string;
  endpointId?: string;
}): Promise<DeliveryView[]> {
  requirePerm(input.actor, input.organizationId, "integrations.logs");
  const rows = await prisma.webhookDelivery.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.endpointId ? { endpointId: input.endpointId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((d) => ({
    id: d.id,
    eventType: d.eventType,
    status: d.status,
    httpStatus: d.httpStatus,
    durationMs: d.durationMs,
    attempts: d.attempts,
    error: d.error,
    createdAt: d.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Delivery pipeline (reuses the Automation event bus; durable + retried)
// ---------------------------------------------------------------------------

/** Enqueue deliveries for a published event to all subscribed, enabled endpoints. Idempotent. */
export async function enqueueWebhookDeliveries(event: {
  type: string;
  organizationId: string;
  resourceId?: string | null;
  correlationId: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId: event.organizationId, enabled: true, events: { has: event.type } },
  });
  let queued = 0;
  for (const endpoint of endpoints) {
    try {
      await prisma.webhookDelivery.create({
        data: {
          organizationId: event.organizationId,
          endpointId: endpoint.id,
          eventType: event.type,
          correlationId: event.correlationId,
          status: "PENDING",
          payload: {
            event: event.type,
            resourceId: event.resourceId ?? null,
            correlationId: event.correlationId,
            metadata: event.metadata ?? {},
          } as object,
        },
      });
      queued += 1;
    } catch {
      // unique (endpoint, correlation) → already enqueued. Idempotent.
    }
  }
  return queued;
}

async function deliverOne(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (!delivery || delivery.status === "SUCCESS") return;
  const endpoint = delivery.endpoint;
  const secret = decryptSecret({
    ciphertext: endpoint.ciphertext,
    iv: endpoint.iv,
    authTag: endpoint.authTag,
  });
  const body = JSON.stringify(delivery.payload);
  const ts = Date.now();
  const signature = signWebhookPayload(body, secret, ts);
  const started = Date.now();
  const attempts = delivery.attempts + 1;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ordinex-event": delivery.eventType,
        "x-ordinex-delivery": delivery.id,
        "x-ordinex-signature": `t=${ts},v1=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    const durationMs = Date.now() - started;
    if (res.ok) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SUCCESS",
          httpStatus: res.status,
          durationMs,
          attempts,
          deliveredAt: new Date(),
          error: null,
        },
      });
      await prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: { consecutiveFailures: 0, lastDeliveryAt: new Date(), status: "active" },
      });
      return;
    }
    await handleFailure(
      delivery.id,
      endpoint.id,
      attempts,
      `HTTP ${res.status}`,
      res.status,
      durationMs,
    );
  } catch (error) {
    await handleFailure(
      delivery.id,
      endpoint.id,
      attempts,
      error instanceof Error ? error.message : "delivery failed",
      null,
      Date.now() - started,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function handleFailure(
  deliveryId: string,
  endpointId: string,
  attempts: number,
  error: string,
  httpStatus: number | null,
  durationMs: number,
): Promise<void> {
  const retry = attempts < WEBHOOK_MAX_ATTEMPTS;
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: retry ? "RETRYING" : "FAILED",
      attempts,
      httpStatus,
      durationMs,
      error,
      nextRetryAt: retry ? new Date(Date.now() + webhookBackoffMs(attempts)) : null,
    },
  });
  const endpoint = await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: { consecutiveFailures: { increment: 1 }, lastDeliveryAt: new Date() },
  });
  // Disable an endpoint after sustained severe failure.
  if (endpoint.consecutiveFailures >= 15) {
    await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        enabled: false,
        status: "disabled",
        disabledReason: "Disabled after repeated delivery failures",
      },
    });
  } else if (endpoint.consecutiveFailures >= 3) {
    await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: { status: "degraded" },
    });
  }
}

/** Worker entry point: process due webhook deliveries (PENDING or RETRYING). */
export async function processWebhookDeliveries(
  limit = 50,
  now = new Date(),
): Promise<{ processed: number }> {
  const due = await prisma.webhookDelivery.findMany({
    where: { OR: [{ status: "PENDING" }, { status: "RETRYING", nextRetryAt: { lte: now } }] },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const d of due) await deliverOne(d.id).catch(() => undefined);
  return { processed: due.length };
}

/** Send a one-off test delivery to verify an endpoint. */
export async function testWebhook(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<DeliveryView> {
  requirePerm(input.actor, input.organizationId, "integrations.test");
  const wh = await prisma.webhookEndpoint.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!wh) throw new NotFoundError("Webhook not found");
  const delivery = await prisma.webhookDelivery.create({
    data: {
      organizationId: input.organizationId,
      endpointId: wh.id,
      eventType: "Integration.Test",
      correlationId: createPublicId("test"),
      status: "PENDING",
      payload: {
        event: "Integration.Test",
        metadata: { message: "Ordinex webhook test" },
      } as object,
    },
  });
  await deliverOne(delivery.id);
  const updated = await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } });
  return {
    id: updated!.id,
    eventType: updated!.eventType,
    status: updated!.status,
    httpStatus: updated!.httpStatus,
    durationMs: updated!.durationMs,
    attempts: updated!.attempts,
    error: updated!.error,
    createdAt: updated!.createdAt.toISOString(),
  };
}
