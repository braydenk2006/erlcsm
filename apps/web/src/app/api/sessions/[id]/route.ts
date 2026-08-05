import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getSession,
  markSessionAttendance,
  registerForSession,
  transitionSession,
} from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const patchSchema = z.union([
  z.object({
    action: z.literal("transition"),
    to: z.enum(["SCHEDULED", "OPEN", "ACTIVE", "COMPLETED", "CANCELLED"]),
  }),
  z.object({ action: z.literal("register") }),
  z.object({
    action: z.literal("attendance"),
    membershipId: z.string(),
    status: z.enum(["REGISTERED", "PRESENT", "LATE", "EXCUSED", "LEFT_EARLY", "ABSENT"]),
    minutes: z.number().int().min(0).max(1440).optional(),
  }),
]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "sessions.management");
    const { id } = await params;
    return NextResponse.json(await getSession({ actor, organizationId, sessionId: id }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "sessions.management");
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid session action");
    if (parsed.data.action === "transition") {
      await transitionSession({ actor, organizationId, sessionId: id, to: parsed.data.to });
    } else if (parsed.data.action === "register") {
      await registerForSession({ actor, organizationId, sessionId: id });
    } else {
      await markSessionAttendance({
        actor,
        organizationId,
        sessionId: id,
        membershipId: parsed.data.membershipId,
        status: parsed.data.status,
        minutes: parsed.data.minutes,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
