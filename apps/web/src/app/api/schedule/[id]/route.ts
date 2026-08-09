import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adjustLoggedMinutes,
  assignHost,
  cancelScheduledShift,
  claimShift,
  completeScheduledShift,
  decideClaim,
  getScheduledShiftDetail,
  markShiftAttendance,
  openClaiming,
  publishShift,
  startScheduledShift,
  submitCorrectionRequest,
  syncShiftPrcPresence,
  withdrawClaim,
} from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open_claiming") }),
  z.object({
    action: z.literal("claim"),
    override: z.object({ reason: z.string().min(3) }).optional(),
  }),
  z.object({ action: z.literal("withdraw") }),
  z.object({ action: z.literal("decide_claim"), claimId: z.string(), approve: z.boolean() }),
  z.object({ action: z.literal("assign_host"), membershipId: z.string() }),
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("start"), override: z.boolean().optional() }),
  z.object({
    action: z.literal("attendance"),
    membershipId: z.string(),
    status: z.enum(["REGISTERED", "PRESENT", "LATE", "EXCUSED", "LEFT_EARLY", "ABSENT", "REMOVED"]),
    minutes: z.number().int().min(0).max(1440).optional(),
  }),
  z.object({ action: z.literal("prc_sync") }),
  z.object({ action: z.literal("complete"), notes: z.string().max(2000).optional() }),
  z.object({ action: z.literal("cancel"), reason: z.string().min(3).max(500) }),
  z.object({
    action: z.literal("adjust_minutes"),
    membershipId: z.string(),
    finalMinutes: z.number().int().min(0).max(100000),
    reason: z.string().min(3).max(500),
  }),
  z.object({
    action: z.literal("correction_request"),
    requestedMinutes: z.number().int().min(0).max(100000),
    explanation: z.string().min(3).max(2000),
  }),
]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "shifts.tracking");
    const { id } = await params;
    return NextResponse.json(await getScheduledShiftDetail({ actor, organizationId, id }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "shifts.tracking");
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid shift action");
    const d = parsed.data;
    const base = { actor, organizationId, id };
    let result: unknown = { ok: true };
    switch (d.action) {
      case "open_claiming":
        await openClaiming(base);
        break;
      case "claim":
        result = await claimShift({ ...base, override: d.override });
        break;
      case "withdraw":
        await withdrawClaim(base);
        break;
      case "decide_claim":
        await decideClaim({ ...base, claimId: d.claimId, approve: d.approve });
        break;
      case "assign_host":
        await assignHost({ ...base, membershipId: d.membershipId });
        break;
      case "publish":
        result = await publishShift(base);
        break;
      case "start":
        await startScheduledShift({ ...base, override: d.override });
        break;
      case "attendance":
        await markShiftAttendance({
          ...base,
          membershipId: d.membershipId,
          status: d.status,
          minutes: d.minutes,
        });
        break;
      case "prc_sync":
        result = await syncShiftPrcPresence({ organizationId, id });
        break;
      case "complete":
        await completeScheduledShift({ ...base, notes: d.notes });
        break;
      case "cancel":
        await cancelScheduledShift({ ...base, reason: d.reason });
        break;
      case "adjust_minutes":
        await adjustLoggedMinutes({
          actor,
          organizationId,
          shiftId: id,
          membershipId: d.membershipId,
          finalMinutes: d.finalMinutes,
          reason: d.reason,
        });
        break;
      case "correction_request":
        await submitCorrectionRequest({
          actor,
          organizationId,
          shiftId: id,
          requestedMinutes: d.requestedMinutes,
          explanation: d.explanation,
        });
        break;
    }
    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
