import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import { computeActiveMinutes, formatMinutes, minutesBetween } from "@commandry/operations";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  createPublicId,
} from "@commandry/shared";
import { createNotification } from "../notifications/service";
import { recordParticipationEvent } from "./participation";

export type ShiftView = {
  id: string;
  publicId: string;
  membershipId: string;
  departmentId: string | null;
  type: string;
  status: string;
  notes: string | null;
  startedAt: Date;
  endedAt: Date | null;
  breakMinutes: number;
  activeMinutes: number;
  currentBreakStartedAt: Date | null;
};

function ensure(actor: Actor, organizationId: string, action: Action): void {
  const decision = authorize({ actor, organizationId, action });
  if (!decision.allowed) throw new ForbiddenError(decision.reason);
}

function toView(s: {
  id: string;
  publicId: string;
  membershipId: string;
  departmentId: string | null;
  type: string;
  status: string;
  notes: string | null;
  startedAt: Date;
  endedAt: Date | null;
  breakMinutes: number;
  activeMinutes: number;
  currentBreakStartedAt: Date | null;
}): ShiftView {
  return {
    id: s.id,
    publicId: s.publicId,
    membershipId: s.membershipId,
    departmentId: s.departmentId,
    type: s.type,
    status: s.status,
    notes: s.notes,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    breakMinutes: s.breakMinutes,
    activeMinutes: s.activeMinutes,
    currentBreakStartedAt: s.currentBreakStartedAt,
  };
}

async function activeShiftFor(organizationId: string, membershipId: string) {
  return prisma.shift.findFirst({
    where: { organizationId, membershipId, status: { in: ["ACTIVE", "ON_BREAK"] } },
    orderBy: { startedAt: "desc" },
  });
}

export async function getActiveShift(input: {
  actor: Actor;
  organizationId: string;
}): Promise<ShiftView | null> {
  ensure(input.actor, input.organizationId, "shift:read");
  const shift = await activeShiftFor(input.organizationId, input.actor.membershipId);
  return shift ? toView(shift) : null;
}

export async function startShift(input: {
  actor: Actor;
  organizationId: string;
  departmentId?: string | null;
  type?: string;
  notes?: string;
}): Promise<ShiftView> {
  ensure(input.actor, input.organizationId, "shift:manage_own");
  const existing = await activeShiftFor(input.organizationId, input.actor.membershipId);
  if (existing)
    throw new ConflictError("You already have an active shift. End it before starting another.");

  const startedAt = new Date();
  const shift = await prisma.shift.create({
    data: {
      publicId: createPublicId("shf"),
      organizationId: input.organizationId,
      membershipId: input.actor.membershipId,
      userId: input.actor.userId,
      departmentId: input.departmentId ?? null,
      type: input.type ?? "patrol",
      notes: input.notes ?? null,
      status: "ACTIVE",
      startedAt,
    },
  });
  await recordParticipationEvent({
    organizationId: input.organizationId,
    membershipId: input.actor.membershipId,
    userId: input.actor.userId,
    type: "SHIFT_STARTED",
    occurredAt: startedAt,
    sourceType: "shift",
    sourceId: shift.id,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "shift:manage_own",
    resourceType: "shift",
    resourceId: shift.id,
    source: "WEB",
    metadata: { action: "start" },
  }).catch(() => undefined);
  return toView(shift);
}

export async function startBreak(input: {
  actor: Actor;
  organizationId: string;
}): Promise<ShiftView> {
  ensure(input.actor, input.organizationId, "shift:manage_own");
  const shift = await activeShiftFor(input.organizationId, input.actor.membershipId);
  if (!shift || shift.status !== "ACTIVE") throw new ValidationError("No active shift to pause");
  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data: { status: "ON_BREAK", currentBreakStartedAt: new Date() },
  });
  await recordParticipationEvent({
    organizationId: input.organizationId,
    membershipId: input.actor.membershipId,
    userId: input.actor.userId,
    type: "BREAK_STARTED",
    sourceType: "shift",
    sourceId: shift.id,
  });
  return toView(updated);
}

export async function endBreak(input: {
  actor: Actor;
  organizationId: string;
}): Promise<ShiftView> {
  ensure(input.actor, input.organizationId, "shift:manage_own");
  const shift = await activeShiftFor(input.organizationId, input.actor.membershipId);
  if (!shift || shift.status !== "ON_BREAK" || !shift.currentBreakStartedAt) {
    throw new ValidationError("No break in progress");
  }
  const breakMinutes = shift.breakMinutes + minutesBetween(shift.currentBreakStartedAt, new Date());
  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data: { status: "ACTIVE", breakMinutes, currentBreakStartedAt: null },
  });
  await recordParticipationEvent({
    organizationId: input.organizationId,
    membershipId: input.actor.membershipId,
    userId: input.actor.userId,
    type: "BREAK_ENDED",
    sourceType: "shift",
    sourceId: shift.id,
  });
  return toView(updated);
}

export async function endShift(input: {
  actor: Actor;
  organizationId: string;
}): Promise<ShiftView> {
  ensure(input.actor, input.organizationId, "shift:manage_own");
  const shift = await activeShiftFor(input.organizationId, input.actor.membershipId);
  if (!shift) throw new ValidationError("No active shift to end");

  const endedAt = new Date();
  let breakMinutes = shift.breakMinutes;
  if (shift.status === "ON_BREAK" && shift.currentBreakStartedAt) {
    breakMinutes += minutesBetween(shift.currentBreakStartedAt, endedAt);
  }
  const activeMinutes = computeActiveMinutes(shift.startedAt, endedAt, breakMinutes);

  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data: {
      status: "COMPLETED",
      endedAt,
      breakMinutes,
      activeMinutes,
      currentBreakStartedAt: null,
    },
  });

  // Emit lifecycle + credit events into the shared ledger (activity derives from these).
  await recordParticipationEvent({
    organizationId: input.organizationId,
    membershipId: input.actor.membershipId,
    userId: input.actor.userId,
    type: "SHIFT_ENDED",
    occurredAt: endedAt,
    sourceType: "shift",
    sourceId: shift.id,
  });
  await recordParticipationEvent({
    organizationId: input.organizationId,
    membershipId: input.actor.membershipId,
    userId: input.actor.userId,
    type: "SHIFT_COMPLETED",
    occurredAt: endedAt,
    durationMinutes: activeMinutes,
    sourceType: "shift",
    sourceId: shift.id,
    metadata: { breakMinutes },
  });
  await createNotification({
    organizationId: input.organizationId,
    userId: input.actor.userId,
    type: "shift",
    title: "Shift ended",
    body: `You logged ${formatMinutes(activeMinutes)} of active time.`,
    linkUrl: "/app/activity",
  }).catch(() => undefined);
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "shift:manage_own",
    resourceType: "shift",
    resourceId: shift.id,
    source: "WEB",
    metadata: { action: "end", activeMinutes },
  }).catch(() => undefined);
  return toView(updated);
}

export async function correctShift(input: {
  actor: Actor;
  organizationId: string;
  shiftId: string;
  activeMinutes: number;
  note: string;
}): Promise<void> {
  ensure(input.actor, input.organizationId, "shift:manage_others");
  const shift = await prisma.shift.findFirst({
    where: { id: input.shiftId, organizationId: input.organizationId },
  });
  if (!shift) throw new NotFoundError("Shift not found");
  if (input.activeMinutes < 0) throw new ValidationError("Active minutes cannot be negative");

  const delta = input.activeMinutes - shift.activeMinutes;
  await prisma.shift.update({
    where: { id: shift.id },
    data: {
      activeMinutes: input.activeMinutes,
      correctedByUserId: input.actor.userId,
      correctionNote: input.note,
    },
  });
  // The correction is recorded as an auditable adjustment in the ledger so
  // downstream metrics stay consistent without recomputing shift math.
  await recordParticipationEvent({
    organizationId: input.organizationId,
    membershipId: shift.membershipId,
    userId: shift.userId,
    type: "MANUAL_ADJUSTMENT",
    durationMinutes: delta,
    sourceType: "shift",
    sourceId: shift.id,
    metadata: { reason: input.note, correctedBy: input.actor.userId },
    createdByUserId: input.actor.userId,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "shift:manage_others",
    resourceType: "shift",
    resourceId: shift.id,
    source: "WEB",
    metadata: { action: "correct", delta, note: input.note },
  }).catch(() => undefined);
}

/**
 * System job: auto-close shifts left running past the org's max duration. Emits
 * the same ledger events as a manual end so activity stays consistent. Returns
 * how many shifts were closed. No actor — invoked by the worker.
 */
export async function autoCloseStaleShifts(now: Date = new Date()): Promise<number> {
  const open = await prisma.shift.findMany({
    where: { status: { in: ["ACTIVE", "ON_BREAK"] } },
    orderBy: { startedAt: "asc" },
    take: 500,
  });
  if (open.length === 0) return 0;

  const settingsRows = await prisma.operationsSettings.findMany();
  const maxByOrg = new Map(settingsRows.map((s) => [s.organizationId, s.maxShiftMinutes]));
  let closed = 0;

  for (const shift of open) {
    const maxMinutes = maxByOrg.get(shift.organizationId) ?? 720;
    if (minutesBetween(shift.startedAt, now) <= maxMinutes) continue;

    let breakMinutes = shift.breakMinutes;
    if (shift.status === "ON_BREAK" && shift.currentBreakStartedAt) {
      breakMinutes += minutesBetween(shift.currentBreakStartedAt, now);
    }
    const activeMinutes = Math.min(
      computeActiveMinutes(shift.startedAt, now, breakMinutes),
      maxMinutes,
    );
    await prisma.shift.update({
      where: { id: shift.id },
      data: {
        status: "COMPLETED",
        endedAt: now,
        breakMinutes,
        activeMinutes,
        currentBreakStartedAt: null,
      },
    });
    await recordParticipationEvent({
      organizationId: shift.organizationId,
      membershipId: shift.membershipId,
      userId: shift.userId,
      type: "SHIFT_COMPLETED",
      occurredAt: now,
      durationMinutes: activeMinutes,
      sourceType: "shift",
      sourceId: shift.id,
      metadata: { breakMinutes, autoClosed: true },
    });
    await createNotification({
      organizationId: shift.organizationId,
      userId: shift.userId,
      type: "shift",
      title: "Shift auto-closed",
      body: `Your shift exceeded the maximum duration and was closed with ${formatMinutes(activeMinutes)} logged.`,
      linkUrl: "/app/activity",
      dedupeKey: `shift-autoclose:${shift.id}`,
    }).catch(() => undefined);
    closed += 1;
  }
  return closed;
}

export async function listShifts(input: {
  actor: Actor;
  organizationId: string;
  membershipId?: string;
}): Promise<ShiftView[]> {
  const own = !input.membershipId || input.membershipId === input.actor.membershipId;
  ensure(input.actor, input.organizationId, own ? "shift:read" : "shift:manage_others");
  const shifts = await prisma.shift.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.membershipId ? { membershipId: input.membershipId } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return shifts.map(toView);
}
