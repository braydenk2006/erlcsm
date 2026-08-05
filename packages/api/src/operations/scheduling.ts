import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import { getDiscordClientForOrganization } from "@commandry/integrations";
import {
  DEFAULT_ANNOUNCEMENT_TEMPLATE,
  canTransitionScheduledShift,
  detectConflicts,
  evaluateEligibility,
  renderAnnouncementTemplate,
  type PrcSyncPolicy,
  type ScheduledShiftStatus,
} from "@commandry/operations";
import { authorize, type Action, type Actor } from "@commandry/permissions";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  createPublicId,
} from "@commandry/shared";
import { createNotification, notifyUsers } from "../notifications/service";
import { recordAttendance } from "./attendance";
import { recordParticipationEvent } from "./participation";
import {
  finalizeShiftLoggedMinutes,
  getPresenceReview,
  syncShiftPresence,
  type PresenceReviewRow,
} from "./presence-tracking";

function ensurePerm(actor: Actor, organizationId: string, action: Action): void {
  const decision = authorize({ actor, organizationId, action });
  if (!decision.allowed) throw new ForbiddenError(decision.reason);
}

// ---------------------------------------------------------------------------
// Settings + shift timeline (the single shift log — no per-integration logs)
// ---------------------------------------------------------------------------

export async function ensureSchedulingSettings(organizationId: string) {
  return prisma.shiftSchedulingSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
}

async function recordShiftEvent(
  organizationId: string,
  scheduledShiftId: string,
  type: string,
  actorUserId?: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await prisma.scheduledShiftEvent.create({
    data: {
      organizationId,
      scheduledShiftId,
      type,
      actorUserId: actorUserId ?? null,
      metadata: metadata as object,
    },
  });
}

const CTX = "scheduled_shift";

export type ScheduledShiftView = {
  id: string;
  publicId: string;
  title: string;
  description: string | null;
  shiftType: string;
  departmentId: string | null;
  erlcServer: string | null;
  timezone: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  claimPolicy: string;
  prcSyncPolicy: string;
  hostMembershipId: string | null;
  discordState: string;
  discordEventId: string | null;
  prcSyncState: string;
  version: number;
};

function toView(s: {
  id: string;
  publicId: string;
  title: string;
  description: string | null;
  shiftType: string;
  departmentId: string | null;
  erlcServer: string | null;
  timezone: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: string;
  claimPolicy: string;
  prcSyncPolicy: string;
  hostMembershipId: string | null;
  discordState: string;
  discordEventId: string | null;
  prcSyncState: string;
  version: number;
}): ScheduledShiftView {
  return {
    id: s.id,
    publicId: s.publicId,
    title: s.title,
    description: s.description,
    shiftType: s.shiftType,
    departmentId: s.departmentId,
    erlcServer: s.erlcServer,
    timezone: s.timezone,
    scheduledStart: s.scheduledStart.toISOString(),
    scheduledEnd: s.scheduledEnd.toISOString(),
    status: s.status,
    claimPolicy: s.claimPolicy,
    prcSyncPolicy: s.prcSyncPolicy,
    hostMembershipId: s.hostMembershipId,
    discordState: s.discordState,
    discordEventId: s.discordEventId,
    prcSyncState: s.prcSyncState,
    version: s.version,
  };
}

async function requireShift(organizationId: string, id: string) {
  const shift = await prisma.scheduledShift.findFirst({ where: { id, organizationId } });
  if (!shift) throw new NotFoundError("Scheduled shift not found");
  return shift;
}

// ---------------------------------------------------------------------------
// Create / list / detail / edit / cancel
// ---------------------------------------------------------------------------

export async function createScheduledShift(input: {
  actor: Actor;
  organizationId: string;
  title: string;
  description?: string;
  shiftType?: string;
  departmentId?: string | null;
  erlcServer?: string | null;
  timezone?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  capacity?: number | null;
  claimPolicy?: string;
  prcSyncPolicy?: string;
  requiredPermission?: string | null;
  requiredDepartmentId?: string | null;
  minRankOrder?: number | null;
}): Promise<ScheduledShiftView> {
  ensurePerm(input.actor, input.organizationId, "shifts.schedule");
  if (input.title.trim().length < 2) throw new ValidationError("Shift title is too short");
  if (input.scheduledEnd.getTime() <= input.scheduledStart.getTime()) {
    throw new ValidationError("Scheduled end must be after the start");
  }
  const shift = await prisma.scheduledShift.create({
    data: {
      publicId: createPublicId("sch"),
      organizationId: input.organizationId,
      title: input.title.trim(),
      description: input.description ?? null,
      shiftType: input.shiftType ?? "patrol",
      departmentId: input.departmentId ?? null,
      erlcServer: input.erlcServer ?? null,
      timezone: input.timezone ?? "UTC",
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      capacity: input.capacity ?? null,
      claimPolicy: input.claimPolicy ?? "FIRST_ELIGIBLE",
      prcSyncPolicy: input.prcSyncPolicy ?? "SUGGEST_ONLY",
      requiredPermission: input.requiredPermission ?? null,
      requiredDepartmentId: input.requiredDepartmentId ?? null,
      minRankOrder: input.minRankOrder ?? null,
      createdByUserId: input.actor.userId,
    },
  });
  await recordShiftEvent(input.organizationId, shift.id, "SHIFT_CREATED", input.actor.userId, {
    title: shift.title,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "shifts.schedule",
    resourceType: "scheduled_shift",
    resourceId: shift.id,
    source: "WEB",
    metadata: { action: "create" },
  }).catch(() => undefined);
  return toView(shift);
}

export async function listScheduledShifts(input: {
  actor: Actor;
  organizationId: string;
  from?: Date;
  to?: Date;
  status?: string;
  departmentId?: string;
  mine?: boolean;
}): Promise<ScheduledShiftView[]> {
  ensurePerm(input.actor, input.organizationId, "shifts.attendance.view");
  const shifts = await prisma.scheduledShift.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.from || input.to
        ? {
            scheduledStart: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.departmentId ? { departmentId: input.departmentId } : {}),
      ...(input.mine ? { hostMembershipId: input.actor.membershipId } : {}),
    },
    orderBy: { scheduledStart: "asc" },
    take: 200,
  });
  return shifts.map(toView);
}

export type ScheduledShiftDetail = {
  shift: ScheduledShiftView;
  claims: {
    id: string;
    membershipId: string;
    userId: string;
    role: string;
    status: string;
    reason: string | null;
  }[];
  attendance: {
    membershipId: string;
    userId: string;
    name: string;
    status: string;
    minutes: number;
    note: string | null;
  }[];
  timeline: { type: string; occurredAt: string; metadata: Record<string, unknown> }[];
  prcMatches: {
    robloxUserId: string;
    robloxUsername: string;
    membershipId: string | null;
    team: string | null;
    presenceMinutes: number;
    applied: boolean;
  }[];
  loggedMinutes: PresenceReviewRow[];
};

export async function getScheduledShiftDetail(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<ScheduledShiftDetail> {
  ensurePerm(input.actor, input.organizationId, "shifts.attendance.view");
  const shift = await requireShift(input.organizationId, input.id);
  const [claims, attendance, events, prcMatches] = await Promise.all([
    prisma.shiftClaim.findMany({
      where: { scheduledShiftId: shift.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { organizationId: input.organizationId, contextType: CTX, contextId: shift.id },
    }),
    prisma.scheduledShiftEvent.findMany({
      where: { scheduledShiftId: shift.id },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    prisma.prcPresenceMatch.findMany({
      where: { scheduledShiftId: shift.id },
      orderBy: { lastSeenAt: "desc" },
    }),
  ]);
  const userIds = [...new Set(attendance.map((a) => a.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const loggedMinutes = await getPresenceReview({
    organizationId: input.organizationId,
    shiftId: shift.id,
  });

  return {
    shift: toView(shift),
    loggedMinutes,
    claims: claims.map((c) => ({
      id: c.id,
      membershipId: c.membershipId,
      userId: c.userId,
      role: c.role,
      status: c.status,
      reason: c.reason,
    })),
    attendance: attendance.map((a) => ({
      membershipId: a.membershipId,
      userId: a.userId,
      name: nameById.get(a.userId) ?? "Member",
      status: a.status,
      minutes: a.minutes,
      note: a.note,
    })),
    timeline: events.map((e) => ({
      type: e.type,
      occurredAt: e.occurredAt.toISOString(),
      metadata: e.metadata as Record<string, unknown>,
    })),
    prcMatches: prcMatches.map((m) => ({
      robloxUserId: m.robloxUserId,
      robloxUsername: m.robloxUsername,
      membershipId: m.membershipId,
      team: m.team,
      presenceMinutes: m.presenceMinutes,
      applied: m.applied,
    })),
  };
}

export async function cancelScheduledShift(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  reason: string;
}): Promise<void> {
  ensurePerm(input.actor, input.organizationId, "shifts.cancel");
  const shift = await requireShift(input.organizationId, input.id);
  if (!canTransitionScheduledShift(shift.status as ScheduledShiftStatus, "CANCELLED")) {
    throw new ValidationError(`Cannot cancel a ${shift.status} shift`);
  }
  await prisma.scheduledShift.update({
    where: { id: shift.id },
    data: { status: "CANCELLED", cancellationReason: input.reason },
  });
  // Cancel the Discord event where configured + present (idempotent).
  const settings = await ensureSchedulingSettings(input.organizationId);
  if (settings.cancelDeletesEvent && shift.discordEventId) {
    const discord = await getDiscordClientForOrganization(input.organizationId);
    await discord.cancelScheduledEvent(shift.discordEventId).catch(() => undefined);
  }
  await recordShiftEvent(input.organizationId, shift.id, "SHIFT_CANCELLED", input.actor.userId, {
    reason: input.reason,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "shifts.cancel",
    resourceType: "scheduled_shift",
    resourceId: shift.id,
    source: "WEB",
    metadata: { reason: input.reason },
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Claiming (eligibility + conflict + concurrency)
// ---------------------------------------------------------------------------

async function membershipEligibilityContext(organizationId: string, actor: Actor) {
  const membership = await prisma.membership.findFirst({
    where: { id: actor.membershipId, organizationId },
    include: { rank: true },
  });
  return {
    isActive: membership?.status === "ACTIVE",
    permissionKeys: actor.permissionKeys,
    departmentIds: actor.departmentIds,
    rankOrder: membership?.rank?.order ?? null,
  };
}

async function actorConflicts(
  organizationId: string,
  actor: Actor,
  candidate: { start: Date; end: Date },
  excludeId?: string,
) {
  const existing = await prisma.scheduledShift.findMany({
    where: {
      organizationId,
      hostMembershipId: actor.membershipId,
      status: { in: ["CLAIMED", "SCHEDULED", "PUBLISHED", "STARTING", "ACTIVE"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { scheduledStart: true, scheduledEnd: true },
  });
  return detectConflicts(
    candidate,
    existing.map((e) => ({ start: e.scheduledStart, end: e.scheduledEnd })),
  );
}

export async function openClaiming(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<void> {
  ensurePerm(input.actor, input.organizationId, "shifts.schedule");
  const shift = await requireShift(input.organizationId, input.id);
  if (!canTransitionScheduledShift(shift.status as ScheduledShiftStatus, "OPEN_CLAIMING")) {
    throw new ValidationError(`Cannot open claiming from ${shift.status}`);
  }
  await prisma.scheduledShift.update({
    where: { id: shift.id },
    data: { status: "OPEN_CLAIMING" },
  });
  await recordShiftEvent(input.organizationId, shift.id, "CLAIMING_OPENED", input.actor.userId);
  // Notify eligible staff that a shift is available.
  const members = await prisma.membership.findMany({
    where: { organizationId: input.organizationId, status: "ACTIVE" },
    select: { userId: true },
  });
  await notifyUsers({
    organizationId: input.organizationId,
    userIds: members.map((m) => m.userId),
    type: "shift",
    title: `Shift available: ${shift.title}`,
    body: "A scheduled shift is open for claiming.",
    linkUrl: "/app/schedule",
    dedupeKey: `shift-open:${shift.id}`,
  }).catch(() => undefined);
}

export async function claimShift(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  override?: { reason: string };
}): Promise<{ status: string }> {
  ensurePerm(input.actor, input.organizationId, "shifts.claim");
  const shift = await requireShift(input.organizationId, input.id);
  if (shift.status !== "OPEN_CLAIMING")
    throw new ValidationError("This shift is not open for claiming");
  if (shift.claimPolicy === "ASSIGNED_ONLY")
    throw new ForbiddenError("This shift is assigned by a scheduler only");

  // Eligibility (server-side).
  const ctx = await membershipEligibilityContext(input.organizationId, input.actor);
  const eligibility = evaluateEligibility(ctx, {
    requiredPermission: shift.requiredPermission,
    requiredDepartmentId: shift.requiredDepartmentId,
    minRankOrder: shift.minRankOrder,
  });
  if (!eligibility.eligible)
    throw new ForbiddenError(`Not eligible: ${eligibility.reasons.join("; ")}`);

  // Conflict detection (overlap with own scheduled/active shifts).
  const conflicts = await actorConflicts(
    input.organizationId,
    input.actor,
    { start: shift.scheduledStart, end: shift.scheduledEnd },
    shift.id,
  );
  if (conflicts.length > 0) {
    if (!input.override)
      throw new ConflictError(
        "You have an overlapping shift. An authorized override with a reason is required.",
      );
    ensurePerm(input.actor, input.organizationId, "shifts.assign_host");
  }

  if (shift.claimPolicy === "APPROVAL_REQUIRED") {
    await prisma.shiftClaim.create({
      data: {
        publicId: createPublicId("clm"),
        organizationId: input.organizationId,
        scheduledShiftId: shift.id,
        membershipId: input.actor.membershipId,
        userId: input.actor.userId,
        role: "host",
        status: "REQUESTED",
        ...(input.override ? { reason: input.override.reason } : {}),
      },
    });
    await prisma.scheduledShift.update({
      where: { id: shift.id },
      data: { status: "AWAITING_APPROVAL" },
    });
    await recordShiftEvent(input.organizationId, shift.id, "CLAIM_REQUESTED", input.actor.userId);
    // Notify approvers.
    await notifyManagers(input.organizationId, `Claim request: ${shift.title}`, "/app/schedule");
    return { status: "AWAITING_APPROVAL" };
  }

  // FIRST_ELIGIBLE: atomically claim only if still unclaimed (single-host concurrency guard).
  const result = await prisma.scheduledShift.updateMany({
    where: { id: shift.id, status: "OPEN_CLAIMING", hostMembershipId: null },
    data: {
      status: "CLAIMED",
      hostMembershipId: input.actor.membershipId,
      claimedAt: new Date(),
      version: { increment: 1 },
    },
  });
  if (result.count === 0) throw new ConflictError("This shift was just claimed by someone else");
  await prisma.shiftClaim.create({
    data: {
      publicId: createPublicId("clm"),
      organizationId: input.organizationId,
      scheduledShiftId: shift.id,
      membershipId: input.actor.membershipId,
      userId: input.actor.userId,
      role: "host",
      status: "APPROVED",
      ...(input.override ? { reason: input.override.reason } : {}),
    },
  });
  await recordShiftEvent(input.organizationId, shift.id, "HOST_ASSIGNED", input.actor.userId, {
    via: "claim",
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "shifts.claim",
    resourceType: "scheduled_shift",
    resourceId: shift.id,
    source: "WEB",
    metadata: { override: Boolean(input.override) },
  }).catch(() => undefined);
  return { status: "CLAIMED" };
}

export async function withdrawClaim(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<void> {
  const shift = await requireShift(input.organizationId, input.id);
  if (shift.hostMembershipId !== input.actor.membershipId) {
    // withdrawing a pending request
    await prisma.shiftClaim.updateMany({
      where: {
        scheduledShiftId: shift.id,
        membershipId: input.actor.membershipId,
        status: "REQUESTED",
      },
      data: { status: "WITHDRAWN" },
    });
    if (shift.status === "AWAITING_APPROVAL") {
      await prisma.scheduledShift.update({
        where: { id: shift.id },
        data: { status: "OPEN_CLAIMING" },
      });
    }
  } else {
    if (["ACTIVE", "COMPLETED"].includes(shift.status))
      throw new ValidationError("Cannot withdraw after the shift has started");
    await prisma.scheduledShift.update({
      where: { id: shift.id },
      data: { status: "OPEN_CLAIMING", hostMembershipId: null, claimedAt: null },
    });
  }
  await recordShiftEvent(input.organizationId, shift.id, "CLAIM_WITHDRAWN", input.actor.userId);
}

export async function decideClaim(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  claimId: string;
  approve: boolean;
}): Promise<void> {
  ensurePerm(input.actor, input.organizationId, "shifts.claim.approve");
  const shift = await requireShift(input.organizationId, input.id);
  const claim = await prisma.shiftClaim.findFirst({
    where: { id: input.claimId, scheduledShiftId: shift.id, status: "REQUESTED" },
  });
  if (!claim) throw new NotFoundError("Pending claim not found");
  await prisma.shiftClaim.update({
    where: { id: claim.id },
    data: {
      status: input.approve ? "APPROVED" : "DENIED",
      decidedByUserId: input.actor.userId,
      decidedAt: new Date(),
    },
  });
  if (input.approve) {
    await prisma.scheduledShift.update({
      where: { id: shift.id },
      data: { status: "CLAIMED", hostMembershipId: claim.membershipId, claimedAt: new Date() },
    });
  } else if (shift.status === "AWAITING_APPROVAL") {
    await prisma.scheduledShift.update({
      where: { id: shift.id },
      data: { status: "OPEN_CLAIMING" },
    });
  }
  await recordShiftEvent(
    input.organizationId,
    shift.id,
    input.approve ? "CLAIM_APPROVED" : "CLAIM_DENIED",
    input.actor.userId,
  );
  await createNotification({
    organizationId: input.organizationId,
    userId: claim.userId,
    type: "shift",
    title: input.approve ? `Claim approved: ${shift.title}` : `Claim denied: ${shift.title}`,
    linkUrl: "/app/schedule",
  }).catch(() => undefined);
}

export async function assignHost(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  membershipId: string;
}): Promise<void> {
  ensurePerm(input.actor, input.organizationId, "shifts.assign_host");
  const shift = await requireShift(input.organizationId, input.id);
  const membership = await prisma.membership.findFirst({
    where: { id: input.membershipId, organizationId: input.organizationId },
  });
  if (!membership) throw new NotFoundError("Member not found");
  await prisma.scheduledShift.update({
    where: { id: shift.id },
    data: {
      hostMembershipId: membership.id,
      status:
        shift.status === "DRAFT" || shift.status === "OPEN_CLAIMING" || shift.status === "NO_HOST"
          ? "CLAIMED"
          : shift.status,
      claimedAt: new Date(),
    },
  });
  await recordShiftEvent(input.organizationId, shift.id, "HOST_ASSIGNED", input.actor.userId, {
    via: "assign",
  });
}

async function notifyManagers(
  organizationId: string,
  title: string,
  linkUrl: string,
): Promise<void> {
  const members = await prisma.membership.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      roles: { some: { role: { key: { in: ["owner", "admin"] } } } },
    },
    select: { userId: true },
  });
  await notifyUsers({
    organizationId,
    userIds: members.map((m) => m.userId),
    type: "shift",
    title,
    linkUrl,
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Publish to Discord (idempotent, partial-state, retry-safe)
// ---------------------------------------------------------------------------

export async function publishShift(input: {
  actor: Actor;
  organizationId: string;
  id: string;
}): Promise<{ discordState: string }> {
  ensurePerm(input.actor, input.organizationId, "shifts.publish_discord");
  const shift = await requireShift(input.organizationId, input.id);
  const settings = await ensureSchedulingSettings(input.organizationId);

  if (!shift.hostMembershipId && !settings.allowPublishWithoutHost) {
    throw new ValidationError("A host is required before publishing (org policy).");
  }
  if (!["CLAIMED", "SCHEDULED", "PUBLISHED"].includes(shift.status)) {
    throw new ValidationError(`Cannot publish a ${shift.status} shift`);
  }
  const channelId = settings.discordChannelId ?? "mock-channel";

  const discord = await getDiscordClientForOrganization(input.organizationId);
  const values = {
    "shift.title": shift.title,
    "shift.department": shift.departmentId ?? "—",
    "shift.start_time": shift.scheduledStart.toISOString(),
    "shift.end_time": shift.scheduledEnd.toISOString(),
    "shift.timezone": shift.timezone,
    "shift.host": shift.hostMembershipId ?? "Unassigned",
    "shift.co_hosts": shift.coHostMembershipIds.join(", ") || "—",
    "shift.server_name": shift.erlcServer ?? "—",
    "shift.description": shift.description ?? "",
    "shift.staff_count": String(shift.requiredStaffCount),
    "shift.url": `/app/schedule/${shift.id}`,
  };
  const content = renderAnnouncementTemplate(
    settings.announcementTemplate ?? DEFAULT_ANNOUNCEMENT_TEMPLATE,
    values,
  );

  let discordMessageId = shift.discordMessageId;
  let discordEventId = shift.discordEventId;
  let messageOk = Boolean(discordMessageId);
  let eventOk = Boolean(discordEventId);

  // Idempotency: only perform steps that have not already succeeded.
  if (!discordMessageId) {
    try {
      const res = await discord.postAnnouncement(channelId, content);
      discordMessageId = res.messageId;
      messageOk = true;
      await recordShiftEvent(
        input.organizationId,
        shift.id,
        "DISCORD_MESSAGE_CREATED",
        input.actor.userId,
        { messageId: res.messageId },
      );
    } catch {
      messageOk = false;
    }
  }
  if (!discordEventId) {
    try {
      const res = await discord.createScheduledEvent({
        name: shift.title,
        description: `${shift.description ?? ""}\n${values["shift.url"]}`.trim(),
        startsAt: shift.scheduledStart,
        endsAt: shift.scheduledEnd,
        location: settings.discordEventLocation ?? shift.erlcServer ?? "ER:LC",
      });
      discordEventId = res.eventId;
      eventOk = true;
      await recordShiftEvent(
        input.organizationId,
        shift.id,
        "DISCORD_EVENT_CREATED",
        input.actor.userId,
        { eventId: res.eventId },
      );
    } catch {
      eventOk = false;
    }
  }

  const discordState =
    messageOk && eventOk ? "PUBLISHED" : messageOk || eventOk ? "PARTIAL" : "FAILED";
  await prisma.scheduledShift.update({
    where: { id: shift.id },
    data: {
      discordChannelId: channelId,
      discordMessageId,
      discordEventId,
      discordState,
      ...(discordState !== "FAILED"
        ? { status: "PUBLISHED", publishedAt: shift.publishedAt ?? new Date() }
        : {}),
    },
  });
  if (discordState === "PARTIAL") {
    await recordShiftEvent(input.organizationId, shift.id, "DISCORD_PARTIAL", input.actor.userId, {
      messageOk,
      eventOk,
    });
  }
  if (shift.hostMembershipId) {
    const host = await prisma.membership.findUnique({ where: { id: shift.hostMembershipId } });
    if (host) {
      await createNotification({
        organizationId: input.organizationId,
        userId: host.userId,
        type: "shift",
        title: `Shift published: ${shift.title}`,
        linkUrl: `/app/schedule/${shift.id}`,
      }).catch(() => undefined);
    }
  }
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "shifts.publish_discord",
    resourceType: "scheduled_shift",
    resourceId: shift.id,
    source: "WEB",
    metadata: { discordState },
  }).catch(() => undefined);
  return { discordState };
}

// ---------------------------------------------------------------------------
// Start / attendance / PRC / complete
// ---------------------------------------------------------------------------

export async function startScheduledShift(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  override?: boolean;
}): Promise<void> {
  ensurePerm(input.actor, input.organizationId, "shifts.start");
  const shift = await requireShift(input.organizationId, input.id);
  const isHost = shift.hostMembershipId === input.actor.membershipId;
  const isManager = authorize({
    actor: input.actor,
    organizationId: input.organizationId,
    action: "shifts.schedule",
  }).allowed;
  if (!isHost && !isManager)
    throw new ForbiddenError("Only the host or a manager can start this shift");
  if (!["PUBLISHED", "SCHEDULED", "CLAIMED"].includes(shift.status))
    throw new ValidationError(`Cannot start a ${shift.status} shift`);

  const settings = await ensureSchedulingSettings(input.organizationId);
  const earliest = shift.scheduledStart.getTime() - settings.startWindowMinutes * 60_000;
  if (!input.override && Date.now() < earliest) {
    throw new ValidationError(
      "Too early to start this shift. Use an authorized override to start early.",
    );
  }
  await prisma.scheduledShift.update({
    where: { id: shift.id },
    data: {
      status: "ACTIVE",
      actualStart: new Date(),
      prcSyncState: shift.erlcServer ? "ACTIVE" : "IDLE",
    },
  });
  await recordShiftEvent(input.organizationId, shift.id, "SHIFT_STARTED", input.actor.userId, {
    override: Boolean(input.override),
  });
  await recordShiftEvent(input.organizationId, shift.id, "ATTENDANCE_OPENED", input.actor.userId);
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "shifts.start",
    resourceType: "scheduled_shift",
    resourceId: shift.id,
    source: "WEB",
  }).catch(() => undefined);
}

export async function markShiftAttendance(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  membershipId: string;
  status: string;
  minutes?: number;
  source?: string;
}): Promise<void> {
  ensurePerm(input.actor, input.organizationId, "shifts.attendance.manage");
  const shift = await requireShift(input.organizationId, input.id);
  const membership = await prisma.membership.findFirst({
    where: { id: input.membershipId, organizationId: input.organizationId },
  });
  if (!membership) throw new NotFoundError("Member not found");
  await recordAttendance({
    organizationId: input.organizationId,
    contextType: CTX,
    contextId: shift.id,
    membershipId: membership.id,
    userId: membership.userId,
    status: input.status as never,
    minutes: input.minutes,
    recordedByUserId: input.actor.userId,
  });
  await recordShiftEvent(input.organizationId, shift.id, "ATTENDANCE_MARKED", input.actor.userId, {
    membershipId: membership.id,
    status: input.status,
    source: input.source ?? "manual",
  });
}

/**
 * PRC synchronization for an active shift. Delegates verified presence-interval
 * tracking to the presence engine (the authoritative source of logged minutes),
 * then applies attendance STATUS per policy. Attendance status is separate from
 * verified logged minutes — marking present never awards minutes.
 */
export async function syncShiftPrcPresence(input: {
  organizationId: string;
  id: string;
}): Promise<{ matched: number; applied: number }> {
  const shift = await prisma.scheduledShift.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!shift || shift.status !== "ACTIVE") return { matched: 0, applied: 0 };

  const res = await syncShiftPresence({ organizationId: input.organizationId, id: input.id });
  const policy = shift.prcSyncPolicy as PrcSyncPolicy;
  let applied = 0;

  if (policy === "AUTO_PRESENT" || policy === "AUTO_CHECKIN") {
    const intervals = await prisma.presenceInterval.findMany({
      where: { scheduledShiftId: shift.id, eligible: true },
    });
    const seen = new Set<string>();
    for (const interval of intervals) {
      if (seen.has(interval.membershipId)) continue;
      seen.add(interval.membershipId);
      const manual = await prisma.attendanceRecord.findUnique({
        where: {
          contextType_contextId_membershipId: {
            contextType: CTX,
            contextId: shift.id,
            membershipId: interval.membershipId,
          },
        },
      });
      // Manual attendance always takes precedence over automated status.
      if (manual && manual.recordedByUserId !== null) continue;
      await recordAttendance({
        organizationId: input.organizationId,
        contextType: CTX,
        contextId: shift.id,
        membershipId: interval.membershipId,
        userId: interval.userId,
        status: policy === "AUTO_PRESENT" ? "PRESENT" : "REGISTERED",
      });
      applied += 1;
    }
  }
  return { matched: res.matched, applied };
}

export async function completeScheduledShift(input: {
  actor: Actor;
  organizationId: string;
  id: string;
  notes?: string;
}): Promise<void> {
  ensurePerm(input.actor, input.organizationId, "shifts.complete");
  const shift = await requireShift(input.organizationId, input.id);
  if (shift.status !== "ACTIVE") throw new ValidationError("Only an active shift can be completed");

  const actualEnd = new Date();

  await prisma.scheduledShift.update({
    where: { id: shift.id },
    data: {
      status: "COMPLETED",
      actualEnd,
      completionNotes: input.notes ?? null,
      prcSyncState: "IDLE",
    },
  });

  // Verified logged minutes come ONLY from private-server presence intervals —
  // never from the scheduled duration or attendance status. Finalize per member
  // and credit the shared activity ledger exactly once (stable source id).
  const finals = await finalizeShiftLoggedMinutes(
    {
      id: shift.id,
      organizationId: input.organizationId,
      scheduledStart: shift.scheduledStart,
      scheduledEnd: shift.scheduledEnd,
      actualStart: shift.actualStart,
    },
    actualEnd,
  );
  let credited = 0;
  let totalMinutes = 0;
  for (const [membershipId, { userId, finalMinutes }] of finals) {
    if (finalMinutes <= 0) continue;
    const already = await prisma.participationEvent.findFirst({
      where: {
        organizationId: input.organizationId,
        membershipId,
        sourceType: CTX,
        sourceId: shift.id,
        type: "SHIFT_COMPLETED",
      },
    });
    if (already) continue; // exactly once
    await recordParticipationEvent({
      organizationId: input.organizationId,
      membershipId,
      userId,
      type: "SHIFT_COMPLETED",
      occurredAt: actualEnd,
      durationMinutes: finalMinutes,
      sourceType: CTX,
      sourceId: shift.id,
      metadata: { scheduled: true, verified: true, breakMinutes: 0 },
    });
    credited += 1;
    totalMinutes += finalMinutes;
  }
  const durationMinutes = totalMinutes;

  // Complete/cancel the Discord event where supported.
  if (shift.discordEventId) {
    const discord = await getDiscordClientForOrganization(input.organizationId);
    await discord.cancelScheduledEvent(shift.discordEventId).catch(() => undefined);
    await recordShiftEvent(
      input.organizationId,
      shift.id,
      "DISCORD_EVENT_COMPLETED",
      input.actor.userId,
    );
  }
  await recordShiftEvent(input.organizationId, shift.id, "SHIFT_COMPLETED", input.actor.userId, {
    durationMinutes,
    attendees: credited,
  });
  await recordShiftEvent(input.organizationId, shift.id, "SHIFT_SUMMARY", input.actor.userId, {
    durationMinutes,
    attendees: credited,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "shifts.complete",
    resourceType: "scheduled_shift",
    resourceId: shift.id,
    source: "WEB",
    metadata: { durationMinutes },
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Analytics (reads the shared platform + scheduled-shift records)
// ---------------------------------------------------------------------------

export type SchedulingAnalytics = {
  scheduled: number;
  claimed: number;
  unclaimed: number;
  completed: number;
  cancelled: number;
  missed: number;
  claimRate: number;
  prcAssistedMatches: number;
};

export async function getSchedulingAnalytics(input: {
  actor: Actor;
  organizationId: string;
  days?: number;
}): Promise<SchedulingAnalytics> {
  ensurePerm(input.actor, input.organizationId, "shifts.analytics.view");
  const since = new Date(Date.now() - (input.days ?? 30) * 24 * 60 * 60 * 1000);
  const shifts = await prisma.scheduledShift.findMany({
    where: { organizationId: input.organizationId, scheduledStart: { gte: since } },
    select: { status: true, hostMembershipId: true },
  });
  const scheduled = shifts.length;
  const claimed = shifts.filter((s) => s.hostMembershipId !== null).length;
  const completed = shifts.filter((s) => s.status === "COMPLETED").length;
  const cancelled = shifts.filter((s) => s.status === "CANCELLED").length;
  const missed = shifts.filter((s) => s.status === "MISSED").length;
  const prcAssistedMatches = await prisma.prcPresenceMatch.count({
    where: { organizationId: input.organizationId, applied: true },
  });
  return {
    scheduled,
    claimed,
    unclaimed: scheduled - claimed,
    completed,
    cancelled,
    missed,
    claimRate: scheduled > 0 ? claimed / scheduled : 0,
    prcAssistedMatches,
  };
}
