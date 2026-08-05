import { NextResponse } from "next/server";
import { z } from "zod";
import { goOnDuty, listUnits } from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

const onDutySchema = z.object({
  callsign: z.string().min(1).max(20),
  name: z.string().min(1).max(60),
  type: z.enum(["POLICE", "SHERIFF", "STATE", "FIRE", "EMS", "DISPATCH"]).optional(),
  robloxUsername: z.string().max(60).optional(),
});

export async function GET() {
  try {
    const { organizationId } = await requireCadPermission("cad.dispatch.view");
    return NextResponse.json({ units: await listUnits(organizationId) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await requireCadPermission("cad.units.manage");
    const parsed = onDutySchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Callsign and name are required");
    const unit = await goOnDuty(organizationId, { ...parsed.data, userId });
    return NextResponse.json({ unit }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
