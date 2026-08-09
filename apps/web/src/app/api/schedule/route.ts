import { NextResponse } from "next/server";
import { z } from "zod";
import { createScheduledShift, listScheduledShifts } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional(),
  shiftType: z.string().max(40).optional(),
  departmentId: z.string().nullable().optional(),
  erlcServer: z.string().max(80).nullable().optional(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  capacity: z.number().int().min(1).max(500).nullable().optional(),
  claimPolicy: z.enum(["FIRST_ELIGIBLE", "APPROVAL_REQUIRED", "ASSIGNED_ONLY"]).optional(),
  prcSyncPolicy: z.enum(["SUGGEST_ONLY", "AUTO_PRESENT", "AUTO_CHECKIN", "DISABLED"]).optional(),
  requiredPermission: z.string().nullable().optional(),
  minRankOrder: z.number().int().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "shifts.tracking");
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const shifts = await listScheduledShifts({
      actor,
      organizationId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      status: url.searchParams.get("status") ?? undefined,
      departmentId: url.searchParams.get("departmentId") ?? undefined,
      mine: url.searchParams.get("mine") === "1",
    });
    return NextResponse.json({ shifts });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "shifts.tracking");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid shift");
    const shift = await createScheduledShift({
      actor,
      organizationId,
      ...parsed.data,
      scheduledStart: new Date(parsed.data.scheduledStart),
      scheduledEnd: new Date(parsed.data.scheduledEnd),
    });
    return NextResponse.json({ shift }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
