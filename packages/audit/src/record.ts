import { prisma, type AuditSource, type Prisma } from "@commandry/database";
import { createPublicId } from "@commandry/shared";
import { sanitizeAuditMetadata } from "./sanitize";

export type RecordAuditInput = {
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  requestId?: string | null;
  source: AuditSource;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export async function recordAuditEvent(input: RecordAuditInput) {
  return prisma.auditEvent.create({
    data: {
      publicId: createPublicId("aud"),
      organizationId: input.organizationId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      requestId: input.requestId ?? null,
      source: input.source,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: sanitizeAuditMetadata(input.metadata ?? {}) as Prisma.InputJsonValue,
      before: input.before
        ? (sanitizeAuditMetadata(input.before) as Prisma.InputJsonValue)
        : undefined,
      after: input.after
        ? (sanitizeAuditMetadata(input.after) as Prisma.InputJsonValue)
        : undefined,
    },
  });
}
