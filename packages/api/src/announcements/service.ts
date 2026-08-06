import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";
import { notifyUsers } from "../notifications/service";
import { publishEvent } from "../automation/service";

export type AnnouncementView = {
  id: string;
  publicId: string;
  title: string;
  body: string;
  status: string;
  pinned: boolean;
  departmentId: string | null;
  authorName: string;
  publishedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  read: boolean;
};

function ensure(actor: Actor, organizationId: string, action: Action): void {
  const decision = authorize({ actor, organizationId, action });
  if (!decision.allowed) throw new ForbiddenError(decision.reason);
}

/**
 * List announcements visible to the actor. Managers see all (incl. drafts);
 * members see published, non-expired announcements targeted to the whole org or
 * to a department they belong to.
 */
export async function listAnnouncements(input: {
  actor: Actor;
  organizationId: string;
  userId: string;
}): Promise<AnnouncementView[]> {
  ensure(input.actor, input.organizationId, "announcement:read");
  const canManage = authorize({
    actor: input.actor,
    organizationId: input.organizationId,
    action: "announcement:manage",
  }).allowed;

  const now = new Date();
  let departmentIds: string[] = [];
  if (!canManage) {
    const membership = await prisma.membership.findFirst({
      where: { organizationId: input.organizationId, userId: input.userId },
      include: { departmentMembers: true },
    });
    departmentIds = membership?.departmentMembers.map((dm) => dm.departmentId) ?? [];
  }

  const rows = await prisma.announcement.findMany({
    where: {
      organizationId: input.organizationId,
      ...(canManage
        ? {}
        : {
            status: "PUBLISHED",
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            AND: [{ OR: [{ departmentId: null }, { departmentId: { in: departmentIds } }] }],
          }),
    },
    include: { author: true, reads: { where: { userId: input.userId } } },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((a) => ({
    id: a.id,
    publicId: a.publicId,
    title: a.title,
    body: a.body,
    status: a.status,
    pinned: a.pinned,
    departmentId: a.departmentId,
    authorName: a.author.name,
    publishedAt: a.publishedAt,
    expiresAt: a.expiresAt,
    createdAt: a.createdAt,
    read: a.reads.length > 0,
  }));
}

export async function createAnnouncement(input: {
  actor: Actor;
  organizationId: string;
  title: string;
  body: string;
  departmentId?: string | null;
  pinned?: boolean;
  expiresAt?: Date | null;
}): Promise<{ id: string }> {
  ensure(input.actor, input.organizationId, "announcement:manage");
  if (input.title.trim().length < 2) throw new ValidationError("Title is too short");
  if (input.body.trim().length < 2) throw new ValidationError("Body is too short");
  if (input.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: input.departmentId, organizationId: input.organizationId },
    });
    if (!dept) throw new NotFoundError("Target department not found");
  }
  const created = await prisma.announcement.create({
    data: {
      publicId: createPublicId("ann"),
      organizationId: input.organizationId,
      authorId: input.actor.userId,
      title: input.title.trim(),
      body: input.body.trim(),
      departmentId: input.departmentId ?? null,
      pinned: input.pinned ?? false,
      expiresAt: input.expiresAt ?? null,
    },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "announcement:manage",
    resourceType: "announcement",
    resourceId: created.id,
    source: "WEB",
    metadata: { action: "create" },
  }).catch(() => undefined);
  return { id: created.id };
}

async function requireAnnouncement(organizationId: string, id: string) {
  const announcement = await prisma.announcement.findFirst({ where: { id, organizationId } });
  if (!announcement) throw new NotFoundError("Announcement not found");
  return announcement;
}

export async function updateAnnouncement(input: {
  actor: Actor;
  organizationId: string;
  announcementId: string;
  title?: string;
  body?: string;
  pinned?: boolean;
  departmentId?: string | null;
  expiresAt?: Date | null;
}): Promise<void> {
  ensure(input.actor, input.organizationId, "announcement:manage");
  const announcement = await requireAnnouncement(input.organizationId, input.announcementId);
  await prisma.announcement.update({
    where: { id: announcement.id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.body !== undefined ? { body: input.body.trim() } : {}),
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    },
  });
}

/** Publish an announcement and fan out in-app notifications to recipients. */
export async function publishAnnouncement(input: {
  actor: Actor;
  organizationId: string;
  announcementId: string;
}): Promise<void> {
  ensure(input.actor, input.organizationId, "announcement:manage");
  const announcement = await requireAnnouncement(input.organizationId, input.announcementId);
  await prisma.announcement.update({
    where: { id: announcement.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  const recipients = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      status: "ACTIVE",
      ...(announcement.departmentId
        ? { departmentMembers: { some: { departmentId: announcement.departmentId } } }
        : {}),
    },
    select: { userId: true },
  });
  await notifyUsers({
    organizationId: input.organizationId,
    userIds: recipients.map((r) => r.userId),
    type: "announcement",
    title: announcement.title,
    linkUrl: "/app/announcements",
    dedupeKey: `announcement:${announcement.id}`,
  });

  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "announcement:manage",
    resourceType: "announcement",
    resourceId: announcement.id,
    source: "WEB",
    metadata: { action: "publish", recipients: recipients.length },
  }).catch(() => undefined);

  await publishEvent({
    type: "Announcement.Published",
    organizationId: input.organizationId,
    resourceId: announcement.id,
    actorUserId: input.actor.userId,
    metadata: { title: announcement.title },
  }).catch(() => undefined);
}

export async function setAnnouncementArchived(input: {
  actor: Actor;
  organizationId: string;
  announcementId: string;
  archived: boolean;
}): Promise<void> {
  ensure(input.actor, input.organizationId, "announcement:manage");
  const announcement = await requireAnnouncement(input.organizationId, input.announcementId);
  await prisma.announcement.update({
    where: { id: announcement.id },
    data: { status: input.archived ? "ARCHIVED" : "DRAFT" },
  });
}

export async function markAnnouncementRead(input: {
  organizationId: string;
  userId: string;
  announcementId: string;
}): Promise<void> {
  const announcement = await requireAnnouncement(input.organizationId, input.announcementId);
  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: announcement.id, userId: input.userId } },
    create: { announcementId: announcement.id, userId: input.userId },
    update: {},
  });
}
