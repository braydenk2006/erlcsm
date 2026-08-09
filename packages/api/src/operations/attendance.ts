import { prisma } from "@commandry/database";
import type { AttendanceStatus } from "@commandry/operations";
import { recordParticipationEvent } from "./participation";

export type AttendanceView = {
  membershipId: string;
  userId: string;
  name: string;
  status: string;
  minutes: number;
  note: string | null;
};

/**
 * Generic attendance engine — reusable by sessions, training, meetings, and any
 * future event through (contextType, contextId). One attendance model, no
 * duplicated logic.
 */
export async function recordAttendance(input: {
  organizationId: string;
  contextType: string;
  contextId: string;
  membershipId: string;
  userId: string;
  status: AttendanceStatus;
  minutes?: number;
  note?: string;
  recordedByUserId?: string;
}): Promise<void> {
  await prisma.attendanceRecord.upsert({
    where: {
      contextType_contextId_membershipId: {
        contextType: input.contextType,
        contextId: input.contextId,
        membershipId: input.membershipId,
      },
    },
    create: {
      organizationId: input.organizationId,
      contextType: input.contextType,
      contextId: input.contextId,
      membershipId: input.membershipId,
      userId: input.userId,
      status: input.status,
      minutes: input.minutes ?? 0,
      note: input.note ?? null,
      registeredAt: input.status === "REGISTERED" ? new Date() : null,
      recordedByUserId: input.recordedByUserId ?? null,
    },
    update: {
      status: input.status,
      ...(input.minutes !== undefined ? { minutes: input.minutes } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      recordedByUserId: input.recordedByUserId ?? null,
    },
  });
  await recordParticipationEvent({
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    userId: input.userId,
    type: "ATTENDANCE_RECORDED",
    sourceType: input.contextType,
    sourceId: input.contextId,
    metadata: { status: input.status },
    createdByUserId: input.recordedByUserId,
  });
}

export async function listAttendance(
  organizationId: string,
  contextType: string,
  contextId: string,
): Promise<AttendanceView[]> {
  const records = await prisma.attendanceRecord.findMany({
    where: { organizationId, contextType, contextId },
    orderBy: { createdAt: "asc" },
  });
  const userIds = [...new Set(records.map((r) => r.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return records.map((r) => ({
    membershipId: r.membershipId,
    userId: r.userId,
    name: nameById.get(r.userId) ?? "Member",
    status: r.status,
    minutes: r.minutes,
    note: r.note,
  }));
}
