import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import {
  attendedStatus,
  canTransitionSession,
  minutesBetween,
  type AttendanceStatus,
  type SessionStatus,
} from "@commandry/operations";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";
import { notifyUsers } from "../notifications/service";
import { recordParticipationEvent } from "./participation";
import { listAttendance, recordAttendance, type AttendanceView } from "./attendance";

export type SessionView = {
  id: string;
  publicId: string;
  title: string;
  type: string;
  status: string;
  notes: string | null;
  scheduledFor: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  hostMembershipId: string | null;
};

function ensure(actor: Actor, organizationId: string, action: Action): void {
  const decision = authorize({ actor, organizationId, action });
  if (!decision.allowed) throw new ForbiddenError(decision.reason);
}

function toView(s: {
  id: string;
  publicId: string;
  title: string;
  type: string;
  status: string;
  notes: string | null;
  scheduledFor: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  hostMembershipId: string | null;
}): SessionView {
  return {
    id: s.id,
    publicId: s.publicId,
    title: s.title,
    type: s.type,
    status: s.status,
    notes: s.notes,
    scheduledFor: s.scheduledFor,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    hostMembershipId: s.hostMembershipId,
  };
}

const CTX = "session";

export async function listSessions(input: {
  actor: Actor;
  organizationId: string;
}): Promise<SessionView[]> {
  ensure(input.actor, input.organizationId, "session:read");
  const sessions = await prisma.operationalSession.findMany({
    where: { organizationId: input.organizationId },
    orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  return sessions.map(toView);
}

export async function getSession(input: {
  actor: Actor;
  organizationId: string;
  sessionId: string;
}): Promise<{ session: SessionView; attendance: AttendanceView[] }> {
  ensure(input.actor, input.organizationId, "session:read");
  const session = await prisma.operationalSession.findFirst({
    where: { id: input.sessionId, organizationId: input.organizationId },
  });
  if (!session) throw new NotFoundError("Session not found");
  const attendance = await listAttendance(input.organizationId, CTX, session.id);
  return { session: toView(session), attendance };
}

export async function createSession(input: {
  actor: Actor;
  organizationId: string;
  title: string;
  type?: string;
  notes?: string;
  scheduledFor?: Date | null;
}): Promise<SessionView> {
  ensure(input.actor, input.organizationId, "session:manage");
  if (input.title.trim().length < 2) throw new ValidationError("Session title is too short");
  const session = await prisma.operationalSession.create({
    data: {
      publicId: createPublicId("ses"),
      organizationId: input.organizationId,
      title: input.title.trim(),
      type: input.type ?? "general",
      notes: input.notes ?? null,
      status: input.scheduledFor ? "SCHEDULED" : "DRAFT",
      scheduledFor: input.scheduledFor ?? null,
      hostMembershipId: input.actor.membershipId,
      createdByUserId: input.actor.userId,
    },
  });
  await recordParticipationEvent({
    organizationId: input.organizationId,
    membershipId: input.actor.membershipId,
    userId: input.actor.userId,
    type: "SESSION_SCHEDULED",
    sourceType: CTX,
    sourceId: session.id,
    metadata: { title: session.title },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "session:manage",
    resourceType: "session",
    resourceId: session.id,
    source: "WEB",
    metadata: { action: "create" },
  }).catch(() => undefined);
  return toView(session);
}

export async function transitionSession(input: {
  actor: Actor;
  organizationId: string;
  sessionId: string;
  to: SessionStatus;
}): Promise<SessionView> {
  ensure(input.actor, input.organizationId, "session:manage");
  const session = await prisma.operationalSession.findFirst({
    where: { id: input.sessionId, organizationId: input.organizationId },
  });
  if (!session) throw new NotFoundError("Session not found");
  if (!canTransitionSession(session.status as SessionStatus, input.to)) {
    throw new ValidationError(`Cannot move a ${session.status} session to ${input.to}`);
  }

  const now = new Date();
  const data: Record<string, unknown> = { status: input.to };
  if (input.to === "ACTIVE") data.startedAt = now;
  if (input.to === "COMPLETED") data.endedAt = now;

  const updated = await prisma.operationalSession.update({
    where: { id: session.id },
    data,
  });

  if (input.to === "OPEN") {
    await recordParticipationEvent({
      organizationId: input.organizationId,
      membershipId: input.actor.membershipId,
      userId: input.actor.userId,
      type: "SESSION_OPENED",
      sourceType: CTX,
      sourceId: session.id,
    });
    const members = await prisma.membership.findMany({
      where: { organizationId: input.organizationId, status: "ACTIVE" },
      select: { userId: true },
    });
    await notifyUsers({
      organizationId: input.organizationId,
      userIds: members.map((m) => m.userId),
      type: "session",
      title: `Session open: ${session.title}`,
      body: "Registration is open.",
      linkUrl: "/app/sessions",
      dedupeKey: `session-open:${session.id}`,
    }).catch(() => undefined);
  }

  if (input.to === "ACTIVE") {
    await recordParticipationEvent({
      organizationId: input.organizationId,
      membershipId: input.actor.membershipId,
      userId: input.actor.userId,
      type: "SESSION_STARTED",
      occurredAt: now,
      sourceType: CTX,
      sourceId: session.id,
    });
  }

  if (input.to === "COMPLETED") {
    const startedAt = session.startedAt ?? session.scheduledFor ?? session.createdAt;
    const duration = minutesBetween(startedAt, now);
    const records = await prisma.attendanceRecord.findMany({
      where: { organizationId: input.organizationId, contextType: CTX, contextId: session.id },
    });
    // Attendance credit flows through the shared ledger, not a separate calc.
    for (const record of records) {
      if (!attendedStatus(record.status as AttendanceStatus)) continue;
      await recordParticipationEvent({
        organizationId: input.organizationId,
        membershipId: record.membershipId,
        userId: record.userId,
        type: "SESSION_ATTENDED",
        occurredAt: now,
        durationMinutes: record.minutes > 0 ? record.minutes : duration,
        sourceType: CTX,
        sourceId: session.id,
        metadata: { attendanceStatus: record.status },
      });
    }
    if (session.hostMembershipId) {
      const host = await prisma.membership.findUnique({ where: { id: session.hostMembershipId } });
      if (host) {
        await recordParticipationEvent({
          organizationId: input.organizationId,
          membershipId: host.id,
          userId: host.userId,
          type: "SESSION_HOSTED",
          occurredAt: now,
          durationMinutes: duration,
          sourceType: CTX,
          sourceId: session.id,
        });
      }
    }
    await recordParticipationEvent({
      organizationId: input.organizationId,
      membershipId: input.actor.membershipId,
      userId: input.actor.userId,
      type: "SESSION_COMPLETED",
      occurredAt: now,
      sourceType: CTX,
      sourceId: session.id,
      metadata: {
        attended: records.filter((r) => attendedStatus(r.status as AttendanceStatus)).length,
      },
    });
  }

  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "session:manage",
    resourceType: "session",
    resourceId: session.id,
    source: "WEB",
    metadata: { action: "transition", to: input.to },
  }).catch(() => undefined);

  return toView(updated);
}

/** Self-registration for a session (any member who can read sessions). */
export async function registerForSession(input: {
  actor: Actor;
  organizationId: string;
  sessionId: string;
}): Promise<void> {
  ensure(input.actor, input.organizationId, "session:read");
  const session = await prisma.operationalSession.findFirst({
    where: { id: input.sessionId, organizationId: input.organizationId },
  });
  if (!session) throw new NotFoundError("Session not found");
  await recordAttendance({
    organizationId: input.organizationId,
    contextType: CTX,
    contextId: session.id,
    membershipId: input.actor.membershipId,
    userId: input.actor.userId,
    status: "REGISTERED",
  });
}

/** Manager marks a member's attendance status/minutes. */
export async function markSessionAttendance(input: {
  actor: Actor;
  organizationId: string;
  sessionId: string;
  membershipId: string;
  status: AttendanceStatus;
  minutes?: number;
}): Promise<void> {
  ensure(input.actor, input.organizationId, "session:manage");
  const membership = await prisma.membership.findFirst({
    where: { id: input.membershipId, organizationId: input.organizationId },
  });
  if (!membership) throw new NotFoundError("Member not found");
  await recordAttendance({
    organizationId: input.organizationId,
    contextType: CTX,
    contextId: input.sessionId,
    membershipId: membership.id,
    userId: membership.userId,
    status: input.status,
    minutes: input.minutes,
    recordedByUserId: input.actor.userId,
  });
}
