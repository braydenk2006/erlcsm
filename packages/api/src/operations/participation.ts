import { prisma } from "@commandry/database";
import {
  EVENT_META,
  buildTimeline,
  complianceStatus,
  computeMetrics,
  formatMinutes,
  type ComplianceStatus,
  type MemberMetrics,
  type ParticipationEventType,
  type TimelineEntry,
} from "@commandry/operations";
import { createPublicId } from "@commandry/shared";

/**
 * Append a participation event to the shared ledger. This is the ONLY writer of
 * activity-bearing data — shift, session, and attendance engines all call it.
 */
export async function recordParticipationEvent(input: {
  organizationId: string;
  membershipId: string;
  userId: string;
  type: ParticipationEventType;
  occurredAt?: Date;
  durationMinutes?: number;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  createdByUserId?: string;
}): Promise<void> {
  await prisma.participationEvent.create({
    data: {
      publicId: createPublicId("pev"),
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      userId: input.userId,
      type: input.type,
      category: EVENT_META[input.type].category,
      occurredAt: input.occurredAt ?? new Date(),
      durationMinutes: input.durationMinutes ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      metadata: (input.metadata ?? {}) as object,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}

export type OperationsSettingsView = {
  requiredMinutesPerPeriod: number;
  periodDays: number;
  maxShiftMinutes: number;
};

export async function ensureOperationsSettings(
  organizationId: string,
): Promise<OperationsSettingsView> {
  const row = await prisma.operationsSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
  return {
    requiredMinutesPerPeriod: row.requiredMinutesPerPeriod,
    periodDays: row.periodDays,
    maxShiftMinutes: row.maxShiftMinutes,
  };
}

export type MemberTimeline = {
  metrics: MemberMetrics;
  compliance: { status: ComplianceStatus; requiredMinutes: number; activeMinutes: number };
  timeline: (Omit<TimelineEntry, "occurredAt"> & { occurredAt: string })[];
};

/** Compute a member's metrics + compliance + chronological history for a period. */
export async function getMemberParticipation(input: {
  organizationId: string;
  membershipId: string;
  periodStart?: Date;
  periodEnd?: Date;
}): Promise<MemberTimeline> {
  const settings = await ensureOperationsSettings(input.organizationId);
  const periodStart =
    input.periodStart ?? new Date(Date.now() - settings.periodDays * 24 * 60 * 60 * 1000);
  const periodEnd = input.periodEnd ?? new Date();

  const events = await prisma.participationEvent.findMany({
    where: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      occurredAt: { gte: periodStart, lte: periodEnd },
    },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });

  const metrics = computeMetrics(
    events.map((e) => ({
      type: e.type as ParticipationEventType,
      durationMinutes: e.durationMinutes,
      metadata: e.metadata as Record<string, unknown>,
    })),
  );
  const timeline = buildTimeline(
    events.map((e) => ({
      type: e.type as ParticipationEventType,
      occurredAt: e.occurredAt,
      durationMinutes: e.durationMinutes,
      metadata: e.metadata as Record<string, unknown>,
    })),
  ).map((entry) => ({ ...entry, occurredAt: entry.occurredAt.toISOString() }));

  return {
    metrics,
    compliance: {
      status: complianceStatus(metrics.totalActiveMinutes, settings.requiredMinutesPerPeriod),
      requiredMinutes: settings.requiredMinutesPerPeriod,
      activeMinutes: metrics.totalActiveMinutes,
    },
    timeline,
  };
}

export { formatMinutes };
