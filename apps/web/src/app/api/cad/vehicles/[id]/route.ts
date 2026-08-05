import { NextResponse } from "next/server";
import { z } from "zod";
import { setVehicleStolen } from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

const patchSchema = z.object({ stolen: z.boolean() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireActiveOrganization();
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid vehicle update");
    await setVehicleStolen(organizationId, id, parsed.data.stolen);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
