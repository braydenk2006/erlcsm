import { recordAuditEvent } from "@commandry/audit";
import { prisma } from "@commandry/database";
import { getErlcClientForOrganization } from "@commandry/integrations";
import {
  buildActivityWindow,
  computeLoggedMinutes,
  type Interval,
  type RoundingPolicy,
} from "@commandry/operations";
import { authorize, type Actor } from "@commandry/permissions";
import { ForbiddenError, NotFoundError, ValidationError, createPublicId } from "@commandry/shared";
import { recordParticipationEvent } from "./participation";

const CTX = "scheduled_shift";

async function shiftEvent(
  organizationId: string,
  scheduledShiftId: string,
  type: string,
  actorUserId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await prisma.scheduledShiftEvent.create({
    data: { organizationId, scheduledShiftId, type, actorUserId, metadata: metadata as object },
  });
}

function eligibleTeamSet(shiftTeams: string[], settingsTeams: string[]): Set<string> | null {
  const teams = shiftTeams.length > 0 ? shiftTeams : settingsTeams;
  if (teams.length === 0) return null; // any team eligible
  return new Set(teams.map((t) => t.toLowerCase()));
}

/**
 * Verified private-server presence sync. Opens/closes presence intervals from
 * PRC snapshots for LINKED players only, honoring team eligibility. Unlinked
 * players are queued for manual review and never earn minutes. Outages preserve
 * open intervals and mark them for review rather than closing/absent.
 */
export async function syncShiftPresence(input: {
  organizationId: string;
  id: string;
}): Promise<{ matched: number; unlinked: number; intervalsOpen: number }> {
  const shift = await prisma.scheduledShift.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!shift || shift.status !== "ACTIVE") return { matched: 0, unlinked: 0, intervalsOpen: 0 };
  const settings = await prisma.shiftSchedulingSettings.findUnique({
    where: { organizationId: input.organizationId },
  });
  const eligible = eligibleTeamSet(shift.eligibleTeams, settings?.eligibleTeams ?? []);

  let players;
  try {
    const { client } = await getErlcClientForOrganization(input.organizationId);
    players = await client.getPlayers();
  } catch {
    // Outage: preserve open intervals; mark them needing review; do NOT close everything.
    await prisma.presenceInterval.updateMany({
      where: { scheduledShiftId: shift.id, open: true },
      data: { reconciliationStatus: "STALE", confidence: "NEEDS_REVIEW" },
    });
    await prisma.scheduledShift.update({
      where: { id: shift.id },
      data: { prcSyncState: "STALE" },
    });
    return { matched: 0, unlinked: 0, intervalsOpen: 0 };
  }

  const now = new Date();
  let matched = 0;
  let unlinked = 0;
  const seenRoblox = new Set<string>();

  for (const player of players) {
    const robloxUserId = String(player.id);
    seenRoblox.add(robloxUserId);
    const identity = await prisma.robloxIdentity.findUnique({ where: { robloxUserId } });
    if (!identity) {
      // Unlinked: reconciliation queue only — never award minutes by username.
      unlinked += 1;
      await prisma.prcPresenceMatch.upsert({
        where: { scheduledShiftId_robloxUserId: { scheduledShiftId: shift.id, robloxUserId } },
        create: {
          organizationId: input.organizationId,
          scheduledShiftId: shift.id,
          robloxUserId,
          robloxUsername: player.name,
          team: player.team,
          callsign: player.callsign,
          firstSeenAt: now,
          lastSeenAt: now,
        },
        update: { lastSeenAt: now, team: player.team, callsign: player.callsign },
      });
      continue;
    }
    matched += 1;
    const membership = await prisma.membership.findFirst({
      where: { organizationId: input.organizationId, userId: identity.userId },
      select: { id: true },
    });
    if (!membership) continue;
    const teamEligible =
      eligible === null || (player.team ? eligible.has(player.team.toLowerCase()) : false);

    const open = await prisma.presenceInterval.findFirst({
      where: { scheduledShiftId: shift.id, robloxUserId, open: true },
    });
    if (open) {
      await prisma.presenceInterval.update({
        where: { id: open.id },
        data: {
          lastSeenAt: now,
          intervalEnd: now,
          durationSeconds: Math.max(
            0,
            Math.floor((now.getTime() - open.intervalStart.getTime()) / 1000),
          ),
          team: player.team,
          callsign: player.callsign,
          permissionLevel: player.permission,
          eligible: teamEligible,
        },
      });
    } else {
      await prisma.presenceInterval.create({
        data: {
          organizationId: input.organizationId,
          scheduledShiftId: shift.id,
          membershipId: membership.id,
          userId: identity.userId,
          robloxUserId,
          erlcServer: shift.erlcServer,
          firstSeenAt: now,
          lastSeenAt: now,
          intervalStart: now,
          intervalEnd: now,
          durationSeconds: 0,
          team: player.team,
          callsign: player.callsign,
          permissionLevel: player.permission,
          source: "prc_snapshot",
          confidence: "CONFIRMED",
          reconciliationStatus: "OPEN",
          open: true,
          eligible: teamEligible,
        },
      });
      await shiftEvent(input.organizationId, shift.id, "PRESENCE_INTERVAL_OPENED", null, {
        robloxUserId,
        membershipId: membership.id,
        team: player.team,
        eligible: teamEligible,
      });
    }
  }

  // Close intervals for players no longer present (leave inferred from last seen).
  const stillOpen = await prisma.presenceInterval.findMany({
    where: { scheduledShiftId: shift.id, open: true },
  });
  let intervalsOpen = 0;
  for (const interval of stillOpen) {
    if (seenRoblox.has(interval.robloxUserId)) {
      intervalsOpen += 1;
      continue;
    }
    await prisma.presenceInterval.update({
      where: { id: interval.id },
      data: {
        open: false,
        intervalEnd: interval.lastSeenAt,
        leaveAt: interval.lastSeenAt,
        durationSeconds: Math.max(
          0,
          Math.floor((interval.lastSeenAt.getTime() - interval.intervalStart.getTime()) / 1000),
        ),
        reconciliationStatus: "CLOSED",
        metadata: { closeSource: "last_seen" },
      },
    });
    await shiftEvent(input.organizationId, shift.id, "PRESENCE_INTERVAL_CLOSED", null, {
      robloxUserId: interval.robloxUserId,
    });
  }

  await prisma.scheduledShift.update({ where: { id: shift.id }, data: { prcSyncState: "ACTIVE" } });
  return { matched, unlinked, intervalsOpen };
}

type ShiftLike = {
  id: string;
  organizationId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart: Date | null;
};

async function loggedConfig(organizationId: string) {
  const s = await prisma.shiftSchedulingSettings.findUnique({ where: { organizationId } });
  return {
    graceBeforeMinutes: s?.graceBeforeMinutes ?? 15,
    graceAfterMinutes: s?.graceAfterMinutes ?? 15,
    windowMode: (s?.windowMode ?? "SCHEDULED_START") as "SCHEDULED_START" | "ACTUAL_START",
    config: {
      reconnectionToleranceSeconds: s?.reconnectionToleranceSeconds ?? 0,
      minPresenceSeconds: s?.minPresenceSeconds ?? 60,
      maxCountableMinutes: s?.maxCountableMinutes ?? 100000,
      rounding: (s?.roundingPolicy ?? "EXACT") as RoundingPolicy,
    },
  };
}

/**
 * Finalize verified logged minutes per member from presence intervals — NOT the
 * scheduled duration. Closes open intervals, sums exact eligible seconds within
 * the activity window, applies rounding, and preserves any manual adjustment.
 */
export async function finalizeShiftLoggedMinutes(
  shift: ShiftLike,
  actualEnd: Date,
): Promise<Map<string, { userId: string; finalMinutes: number }>> {
  // Close any open intervals at the completion time.
  const open = await prisma.presenceInterval.findMany({
    where: { scheduledShiftId: shift.id, open: true },
  });
  for (const interval of open) {
    const end = actualEnd < interval.lastSeenAt ? interval.lastSeenAt : actualEnd;
    await prisma.presenceInterval.update({
      where: { id: interval.id },
      data: {
        open: false,
        intervalEnd: interval.lastSeenAt,
        leaveAt: interval.lastSeenAt,
        reconciliationStatus: "CLOSED",
        metadata: { closeSource: "shift_completed" },
        durationSeconds: Math.max(
          0,
          Math.floor((interval.lastSeenAt.getTime() - interval.intervalStart.getTime()) / 1000),
        ),
      },
    });
    void end;
  }

  const cfg = await loggedConfig(shift.organizationId);
  const window = buildActivityWindow({
    scheduledStart: shift.scheduledStart,
    scheduledEnd: shift.scheduledEnd,
    actualStart: shift.actualStart,
    actualEnd,
    graceBeforeMinutes: cfg.graceBeforeMinutes,
    graceAfterMinutes: cfg.graceAfterMinutes,
    windowMode: cfg.windowMode,
  });

  const intervals = await prisma.presenceInterval.findMany({
    where: { scheduledShiftId: shift.id, eligible: true },
  });
  const byMember = new Map<string, { userId: string; intervals: Interval[] }>();
  for (const i of intervals) {
    const entry = byMember.get(i.membershipId) ?? { userId: i.userId, intervals: [] };
    entry.intervals.push({ start: i.intervalStart, end: i.intervalEnd ?? i.lastSeenAt });
    byMember.set(i.membershipId, entry);
  }

  const finals = new Map<string, { userId: string; finalMinutes: number }>();
  for (const [membershipId, entry] of byMember) {
    const result = computeLoggedMinutes({ intervals: entry.intervals, window, config: cfg.config });
    const existing = await prisma.shiftLoggedMinutes.findUnique({
      where: { scheduledShiftId_membershipId: { scheduledShiftId: shift.id, membershipId } },
    });
    const adjustment = existing?.adjustmentMinutes ?? 0;
    const finalMinutes = Math.max(0, result.minutes + adjustment);
    await prisma.shiftLoggedMinutes.upsert({
      where: { scheduledShiftId_membershipId: { scheduledShiftId: shift.id, membershipId } },
      create: {
        organizationId: shift.organizationId,
        scheduledShiftId: shift.id,
        membershipId,
        userId: entry.userId,
        automaticMinutes: result.minutes,
        adjustmentMinutes: adjustment,
        finalMinutes,
        rawSeconds: Math.floor(result.rawSeconds),
        eligibleSeconds: Math.floor(result.eligibleSeconds),
        reconciliationStatus: adjustment !== 0 ? "MANUALLY_ADJUSTED" : "CONFIRMED",
        finalizedAt: new Date(),
      },
      update: {
        automaticMinutes: result.minutes,
        finalMinutes,
        rawSeconds: Math.floor(result.rawSeconds),
        eligibleSeconds: Math.floor(result.eligibleSeconds),
        reconciliationStatus: adjustment !== 0 ? "MANUALLY_ADJUSTED" : "CONFIRMED",
        finalizedAt: new Date(),
      },
    });
    finals.set(membershipId, { userId: entry.userId, finalMinutes });
  }
  return finals;
}

export type PresenceReviewRow = {
  membershipId: string;
  name: string;
  robloxUserId: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  intervals: {
    start: string;
    end: string;
    seconds: number;
    team: string | null;
    eligible: boolean;
    confidence: string;
    reconciliation: string;
  }[];
  automaticMinutes: number;
  adjustmentMinutes: number;
  finalMinutes: number;
  confidence: string;
  reconciliation: string;
};

/** Host review of verified server minutes: intervals + calculated + final per member. */
export async function getPresenceReview(input: {
  organizationId: string;
  shiftId: string;
}): Promise<PresenceReviewRow[]> {
  const [intervals, logged] = await Promise.all([
    prisma.presenceInterval.findMany({
      where: { scheduledShiftId: input.shiftId },
      orderBy: { intervalStart: "asc" },
    }),
    prisma.shiftLoggedMinutes.findMany({ where: { scheduledShiftId: input.shiftId } }),
  ]);
  const memberIds = [
    ...new Set([...intervals.map((i) => i.membershipId), ...logged.map((l) => l.membershipId)]),
  ];
  const userByMember = new Map<string, string>();
  for (const i of intervals) userByMember.set(i.membershipId, i.userId);
  for (const l of logged) userByMember.set(l.membershipId, l.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: [...userByMember.values()] } },
    select: { id: true, name: true },
  });
  const nameByUser = new Map(users.map((u) => [u.id, u.name]));
  const loggedByMember = new Map(logged.map((l) => [l.membershipId, l]));

  return memberIds.map((membershipId) => {
    const mine = intervals.filter((i) => i.membershipId === membershipId);
    const l = loggedByMember.get(membershipId);
    const userId = userByMember.get(membershipId) ?? "";
    return {
      membershipId,
      name: nameByUser.get(userId) ?? "Member",
      robloxUserId: mine[0]?.robloxUserId ?? null,
      firstSeen: mine[0]?.firstSeenAt.toISOString() ?? null,
      lastSeen: mine.length ? mine[mine.length - 1]!.lastSeenAt.toISOString() : null,
      intervals: mine.map((i) => ({
        start: i.intervalStart.toISOString(),
        end: (i.intervalEnd ?? i.lastSeenAt).toISOString(),
        seconds: i.durationSeconds,
        team: i.team,
        eligible: i.eligible,
        confidence: i.confidence,
        reconciliation: i.reconciliationStatus,
      })),
      automaticMinutes: l?.automaticMinutes ?? 0,
      adjustmentMinutes: l?.adjustmentMinutes ?? 0,
      finalMinutes: l?.finalMinutes ?? 0,
      confidence:
        l?.confidence ??
        (mine.some((i) => i.confidence === "NEEDS_REVIEW") ? "NEEDS_REVIEW" : "CONFIRMED"),
      reconciliation: l?.reconciliationStatus ?? "PENDING",
    };
  });
}

/** Manual adjustment (never overwrites automatic; stores automatic + adjustment + final). */
export async function adjustLoggedMinutes(input: {
  actor: Actor;
  organizationId: string;
  shiftId: string;
  membershipId: string;
  finalMinutes: number;
  reason: string;
}): Promise<void> {
  const decision = authorize({
    actor: input.actor,
    organizationId: input.organizationId,
    action: "shifts.attendance.override",
  });
  if (!decision.allowed) throw new ForbiddenError(decision.reason);
  if (input.finalMinutes < 0) throw new ValidationError("Final minutes cannot be negative");
  if (input.reason.trim().length < 3) throw new ValidationError("A reason is required");

  const existing = await prisma.shiftLoggedMinutes.findUnique({
    where: {
      scheduledShiftId_membershipId: {
        scheduledShiftId: input.shiftId,
        membershipId: input.membershipId,
      },
    },
  });
  const membership = await prisma.membership.findFirst({
    where: { id: input.membershipId, organizationId: input.organizationId },
  });
  if (!membership) throw new NotFoundError("Member not found");
  const automatic = existing?.automaticMinutes ?? 0;
  const adjustment = input.finalMinutes - automatic;

  await prisma.shiftLoggedMinutes.upsert({
    where: {
      scheduledShiftId_membershipId: {
        scheduledShiftId: input.shiftId,
        membershipId: input.membershipId,
      },
    },
    create: {
      organizationId: input.organizationId,
      scheduledShiftId: input.shiftId,
      membershipId: input.membershipId,
      userId: membership.userId,
      automaticMinutes: automatic,
      adjustmentMinutes: adjustment,
      finalMinutes: input.finalMinutes,
      reconciliationStatus: "MANUALLY_ADJUSTED",
    },
    update: {
      adjustmentMinutes: adjustment,
      finalMinutes: input.finalMinutes,
      reconciliationStatus: "MANUALLY_ADJUSTED",
    },
  });

  // If the shift already credited activity, emit the delta so totals stay correct.
  const already = await prisma.participationEvent.findFirst({
    where: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      sourceType: CTX,
      sourceId: input.shiftId,
      type: "SHIFT_COMPLETED",
    },
  });
  if (already && adjustment !== (existing ? existing.adjustmentMinutes : 0)) {
    const delta = adjustment - (existing?.adjustmentMinutes ?? 0);
    if (delta !== 0) {
      await recordParticipationEvent({
        organizationId: input.organizationId,
        membershipId: input.membershipId,
        userId: membership.userId,
        type: "MANUAL_ADJUSTMENT",
        durationMinutes: delta,
        sourceType: CTX,
        sourceId: input.shiftId,
        metadata: { reason: input.reason, adjustedBy: input.actor.userId },
        createdByUserId: input.actor.userId,
      });
    }
  }
  await shiftEvent(
    input.organizationId,
    input.shiftId,
    "LOGGED_MINUTES_ADJUSTED",
    input.actor.userId,
    { membershipId: input.membershipId, finalMinutes: input.finalMinutes, reason: input.reason },
  );
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "shifts.attendance.override",
    resourceType: "shift_logged_minutes",
    resourceId: input.shiftId,
    source: "WEB",
    metadata: {
      membershipId: input.membershipId,
      automatic,
      adjustment,
      final: input.finalMinutes,
      reason: input.reason,
    },
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Correction requests
// ---------------------------------------------------------------------------

export async function submitCorrectionRequest(input: {
  actor: Actor;
  organizationId: string;
  shiftId: string;
  requestedMinutes: number;
  explanation: string;
}): Promise<void> {
  const logged = await prisma.shiftLoggedMinutes.findUnique({
    where: {
      scheduledShiftId_membershipId: {
        scheduledShiftId: input.shiftId,
        membershipId: input.actor.membershipId,
      },
    },
  });
  await prisma.correctionRequest.create({
    data: {
      publicId: createPublicId("cor"),
      organizationId: input.organizationId,
      scheduledShiftId: input.shiftId,
      membershipId: input.actor.membershipId,
      userId: input.actor.userId,
      calculatedMinutes: logged?.finalMinutes ?? 0,
      requestedMinutes: input.requestedMinutes,
      explanation: input.explanation,
    },
  });
  await shiftEvent(
    input.organizationId,
    input.shiftId,
    "CORRECTION_REQUESTED",
    input.actor.userId,
    { requestedMinutes: input.requestedMinutes },
  );
}

export async function decideCorrectionRequest(input: {
  actor: Actor;
  organizationId: string;
  requestId: string;
  decision: "APPROVED" | "PARTIAL" | "DENIED" | "INFO_REQUESTED";
  appliedMinutes?: number;
  note?: string;
}): Promise<void> {
  const decision = authorize({
    actor: input.actor,
    organizationId: input.organizationId,
    action: "shifts.attendance.override",
  });
  if (!decision.allowed) throw new ForbiddenError(decision.reason);
  const request = await prisma.correctionRequest.findFirst({
    where: { id: input.requestId, organizationId: input.organizationId },
  });
  if (!request) throw new NotFoundError("Correction request not found");
  await prisma.correctionRequest.update({
    where: { id: request.id },
    data: {
      status: input.decision,
      reviewerUserId: input.actor.userId,
      decisionNote: input.note ?? null,
      appliedMinutes: input.appliedMinutes ?? null,
      decidedAt: new Date(),
    },
  });
  if (
    (input.decision === "APPROVED" || input.decision === "PARTIAL") &&
    typeof input.appliedMinutes === "number"
  ) {
    await adjustLoggedMinutes({
      actor: input.actor,
      organizationId: input.organizationId,
      shiftId: request.scheduledShiftId,
      membershipId: request.membershipId,
      finalMinutes: input.appliedMinutes,
      reason: `Correction request ${request.publicId}`,
    });
  }
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    action: "shifts.attendance.override",
    resourceType: "correction_request",
    resourceId: request.id,
    source: "WEB",
    metadata: { decision: input.decision, appliedMinutes: input.appliedMinutes },
  }).catch(() => undefined);
}
