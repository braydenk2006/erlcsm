import { prisma } from "@commandry/database";
import { generateOccurrences, type RecurrenceRule } from "@commandry/operations";
import { createPublicId } from "@commandry/shared";
import { createNotification, notifyUsers } from "../notifications/service";
import { syncShiftPrcPresence } from "./scheduling";

const RECURRENCE_HORIZON_DAYS = 30;

/**
 * Extend recurring shift series within a bounded horizon. Idempotent: the
 * (recurrenceId, scheduledStart) unique constraint prevents duplicate
 * occurrences even if the job runs twice.
 */
export async function generateRecurrenceOccurrences(
  now = new Date(),
): Promise<{ created: number }> {
  const recurrences = await prisma.shiftRecurrence.findMany({ where: { active: true } });
  const until = new Date(now.getTime() + RECURRENCE_HORIZON_DAYS * 24 * 60 * 60 * 1000);
  let created = 0;

  for (const rec of recurrences) {
    const horizon = rec.horizonUntil && rec.horizonUntil < until ? rec.horizonUntil : until;
    const occurrences = generateOccurrences(rec.rule as RecurrenceRule, now, horizon, 60);
    for (const start of occurrences) {
      const end = new Date(start.getTime() + rec.durationMinutes * 60_000);
      try {
        await prisma.scheduledShift.create({
          data: {
            publicId: createPublicId("sch"),
            organizationId: rec.organizationId,
            title: rec.title,
            shiftType: rec.shiftType,
            departmentId: rec.departmentId,
            erlcServer: rec.erlcServer,
            timezone: rec.timezone,
            scheduledStart: start,
            scheduledEnd: end,
            status: "OPEN_CLAIMING",
            recurrenceId: rec.id,
            createdByUserId: rec.createdByUserId,
          },
        });
        created += 1;
      } catch {
        // Unique violation => occurrence already exists; skip safely.
      }
    }
  }
  return { created };
}

/** Send due Discord/in-app reminders for upcoming published shifts (idempotent). */
export async function sendDueShiftReminders(now = new Date()): Promise<{ sent: number }> {
  const upcoming = await prisma.scheduledShift.findMany({
    where: { status: "PUBLISHED", scheduledStart: { gte: now } },
    take: 200,
  });
  let sent = 0;
  for (const shift of upcoming) {
    const settings = await prisma.shiftSchedulingSettings.findUnique({
      where: { organizationId: shift.organizationId },
    });
    const offsets = (settings?.reminderOffsets ?? [1440, 60, 15]).sort((a, b) => b - a);
    const minutesUntil = Math.floor((shift.scheduledStart.getTime() - now.getTime()) / 60_000);
    const due = offsets.find(
      (o) =>
        minutesUntil <= o && (shift.lastRemindedOffset === null || o < shift.lastRemindedOffset),
    );
    if (due === undefined || !shift.hostMembershipId) continue;
    const host = await prisma.membership.findUnique({ where: { id: shift.hostMembershipId } });
    if (host) {
      await createNotification({
        organizationId: shift.organizationId,
        userId: host.userId,
        type: "shift",
        title: `Reminder: ${shift.title} starts soon`,
        body: `Starts in ~${due} minutes.`,
        linkUrl: `/app/schedule/${shift.id}`,
        dedupeKey: `shift-reminder:${shift.id}:${due}`,
      }).catch(() => undefined);
    }
    await prisma.scheduledShift.update({
      where: { id: shift.id },
      data: { lastRemindedOffset: due },
    });
    await prisma.scheduledShiftEvent.create({
      data: {
        organizationId: shift.organizationId,
        scheduledShiftId: shift.id,
        type: "REMINDER_SENT",
        metadata: { offset: due },
      },
    });
    sent += 1;
  }
  return { sent };
}

/** PRC synchronization for every active scheduled shift with an ER:LC server. */
export async function syncActiveShiftsPrc(): Promise<{ shifts: number }> {
  const active = await prisma.scheduledShift.findMany({
    where: { status: "ACTIVE", erlcServer: { not: null } },
    select: { id: true, organizationId: true },
    take: 100,
  });
  for (const shift of active) {
    await syncShiftPrcPresence({ organizationId: shift.organizationId, id: shift.id }).catch(
      () => undefined,
    );
  }
  return { shifts: active.length };
}

/** Mark shifts that were never started past their grace window as missed. */
export async function reconcileMissedShifts(now = new Date()): Promise<{ missed: number }> {
  const graceMs = 30 * 60_000;
  const overdue = await prisma.scheduledShift.findMany({
    where: {
      status: {
        in: ["OPEN_CLAIMING", "AWAITING_APPROVAL", "CLAIMED", "SCHEDULED", "PUBLISHED", "NO_HOST"],
      },
      scheduledStart: { lt: new Date(now.getTime() - graceMs) },
      actualStart: null,
    },
    take: 200,
  });
  let missed = 0;
  for (const shift of overdue) {
    await prisma.scheduledShift.update({ where: { id: shift.id }, data: { status: "MISSED" } });
    await prisma.scheduledShiftEvent.create({
      data: {
        organizationId: shift.organizationId,
        scheduledShiftId: shift.id,
        type: "SHIFT_MISSED",
        metadata: {},
      },
    });
    const managers = await prisma.membership.findMany({
      where: {
        organizationId: shift.organizationId,
        status: "ACTIVE",
        roles: { some: { role: { key: { in: ["owner", "admin"] } } } },
      },
      select: { userId: true },
    });
    await notifyUsers({
      organizationId: shift.organizationId,
      userIds: managers.map((m) => m.userId),
      type: "shift",
      title: `Shift missed: ${shift.title}`,
      linkUrl: `/app/schedule/${shift.id}`,
      dedupeKey: `shift-missed:${shift.id}`,
    }).catch(() => undefined);
    missed += 1;
  }
  return { missed };
}
