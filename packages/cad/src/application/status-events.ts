import { prisma } from "@commandry/database";

export type CadSubjectType = "call" | "unit" | "warrant" | "record";

/** Append a status-transition event to the CAD append-only history. */
export async function recordStatusEvent(input: {
  organizationId: string;
  subjectType: CadSubjectType;
  subjectId: string;
  fromStatus?: string | null;
  toStatus: string;
  actorUserId?: string | null;
  note?: string | null;
}): Promise<void> {
  await prisma.cadStatusEvent.create({
    data: {
      organizationId: input.organizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId ?? null,
      note: input.note ?? null,
    },
  });
}

export type StatusEventView = {
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: Date;
};

export async function listStatusEvents(
  organizationId: string,
  subjectType: CadSubjectType,
  subjectPublicId: string,
  limit = 50,
): Promise<StatusEventView[]> {
  const rows = await prisma.cadStatusEvent.findMany({
    where: { organizationId, subjectType, subjectId: subjectPublicId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    note: row.note,
    createdAt: row.createdAt,
  }));
}
