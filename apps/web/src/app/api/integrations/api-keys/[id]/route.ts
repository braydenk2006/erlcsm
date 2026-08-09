import { NextResponse } from "next/server";
import { revokeApiKey } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "api.public");
    const { id } = await params;
    await revokeApiKey({ actor, organizationId, id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
