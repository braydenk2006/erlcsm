import { prisma } from "@commandry/database";
import { NotFoundError, createPublicId } from "@commandry/shared";

export type NotificationView = {
  id: string;
  publicId: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * Create an in-app notification. When `dedupeKey` is supplied, a duplicate for
 * the same (organization, user, key) is silently skipped.
 */
export async function createNotification(input: {
  organizationId: string;
  userId: string;
  type?: string;
  title: string;
  body?: string;
  linkUrl?: string;
  dedupeKey?: string;
}): Promise<void> {
  if (input.dedupeKey) {
    const existing = await prisma.notification.findUnique({
      where: {
        organizationId_userId_dedupeKey: {
          organizationId: input.organizationId,
          userId: input.userId,
          dedupeKey: input.dedupeKey,
        },
      },
    });
    if (existing) return;
  }
  await prisma.notification.create({
    data: {
      publicId: createPublicId("ntf"),
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type ?? "general",
      title: input.title,
      body: input.body ?? null,
      linkUrl: input.linkUrl ?? null,
      dedupeKey: input.dedupeKey ?? null,
    },
  });
}

/** Fan out a notification to many users (e.g. announcement publish). */
export async function notifyUsers(input: {
  organizationId: string;
  userIds: string[];
  type?: string;
  title: string;
  body?: string;
  linkUrl?: string;
  dedupeKey?: string;
}): Promise<void> {
  await Promise.all(
    input.userIds.map((userId) => createNotification({ ...input, userId }).catch(() => undefined)),
  );
}

export async function listNotifications(input: {
  organizationId: string;
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
}): Promise<NotificationView[]> {
  const rows = await prisma.notification.findMany({
    where: {
      organizationId: input.organizationId,
      userId: input.userId,
      ...(input.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(input.limit ?? 50, 100),
  });
  return rows.map((n) => ({
    id: n.id,
    publicId: n.publicId,
    type: n.type,
    title: n.title,
    body: n.body,
    linkUrl: n.linkUrl,
    readAt: n.readAt,
    createdAt: n.createdAt,
  }));
}

export async function unreadNotificationCount(input: {
  organizationId: string;
  userId: string;
}): Promise<number> {
  return prisma.notification.count({
    where: { organizationId: input.organizationId, userId: input.userId, readAt: null },
  });
}

export async function markNotificationRead(input: {
  organizationId: string;
  userId: string;
  notificationId: string;
}): Promise<void> {
  const result = await prisma.notification.updateMany({
    where: {
      id: input.notificationId,
      organizationId: input.organizationId,
      userId: input.userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    const exists = await prisma.notification.findFirst({
      where: {
        id: input.notificationId,
        organizationId: input.organizationId,
        userId: input.userId,
      },
      select: { id: true },
    });
    if (!exists) throw new NotFoundError("Notification not found");
  }
}

export async function markAllNotificationsRead(input: {
  organizationId: string;
  userId: string;
}): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { organizationId: input.organizationId, userId: input.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
