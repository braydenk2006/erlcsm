import { NextResponse } from "next/server";
import { z } from "zod";
import { archiveTenantCharge } from "@commandry/cad";
import { ValidationError } from "@commandry/shared";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

const patchSchema = z.object({ archived: z.boolean() });

/** Archive or restore a tenant penal-code charge. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireCadPermission("cad.configuration.manage");
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("archived flag is required");
    await archiveTenantCharge(organizationId, id, parsed.data.archived);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
