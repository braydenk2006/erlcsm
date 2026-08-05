import { NextResponse } from "next/server";
import { clearWarrant } from "@commandry/cad";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireCadPermission("cad.warrants.review");
    const { id } = await context.params;
    await clearWarrant(organizationId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
