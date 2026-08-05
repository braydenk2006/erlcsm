import { NextResponse } from "next/server";
import { z } from "zod";
import {
  endBreak,
  endShift,
  getActiveShift,
  listShifts,
  startBreak,
  startShift,
} from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  action: z.enum(["start", "break", "resume", "end"]),
  departmentId: z.string().nullable().optional(),
  type: z.string().max(40).optional(),
  notes: z.string().max(500).optional(),
});

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "shifts.tracking");
    const [active, shifts] = await Promise.all([
      getActiveShift({ actor, organizationId }),
      listShifts({ actor, organizationId }),
    ]);
    return NextResponse.json({ active, shifts });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "shifts.tracking");
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid shift action");
    const args = { actor, organizationId };
    let shift;
    if (parsed.data.action === "start") {
      shift = await startShift({
        ...args,
        departmentId: parsed.data.departmentId,
        type: parsed.data.type,
        notes: parsed.data.notes,
      });
    } else if (parsed.data.action === "break") {
      shift = await startBreak(args);
    } else if (parsed.data.action === "resume") {
      shift = await endBreak(args);
    } else {
      shift = await endShift(args);
    }
    return NextResponse.json({ shift });
  } catch (error) {
    return handleRouteError(error);
  }
}
