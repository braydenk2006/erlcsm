import { NextResponse } from "next/server";
import { clearBolo } from "@commandry/cad";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireActiveOrganization();
    const { id } = await context.params;
    await clearBolo(organizationId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
