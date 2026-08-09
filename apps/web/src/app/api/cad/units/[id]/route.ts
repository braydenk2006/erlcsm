import { NextResponse } from "next/server";
import { z } from "zod";
import { goOffDuty, setUnitStatus } from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

const patchSchema = z.object({
  status: z.enum(["AVAILABLE", "BUSY", "EN_ROUTE", "ON_SCENE", "PANIC", "OUT_OF_SERVICE"]),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireCadPermission("cad.units.manage");
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("A valid status is required");
    await setUnitStatus(organizationId, id, parsed.data.status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireCadPermission("cad.units.manage");
    const { id } = await context.params;
    await goOffDuty(organizationId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
