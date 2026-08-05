import { NextResponse } from "next/server";
import { z } from "zod";
import { getCivilian, updateCivilian } from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

const patchSchema = z.object({
  licenseStatus: z.enum(["VALID", "SUSPENDED", "REVOKED", "EXPIRED", "NONE"]).optional(),
  flags: z.array(z.string().max(60)).max(20).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireActiveOrganization();
    const { id } = await context.params;
    const civilian = await getCivilian(organizationId, id);
    if (!civilian) return NextResponse.json({ error: "Civilian not found" }, { status: 404 });
    return NextResponse.json({ civilian });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireActiveOrganization();
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid civilian update");
    await updateCivilian(organizationId, id, parsed.data);
    const civilian = await getCivilian(organizationId, id);
    return NextResponse.json({ ok: true, civilian });
  } catch (error) {
    return handleRouteError(error);
  }
}
