import { NextResponse } from "next/server";
import { getActiveShift, getMemberParticipation } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

// The caller's personal activity dashboard, derived from the participation ledger.
export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "activity.tracking");
    const [participation, activeShift] = await Promise.all([
      getMemberParticipation({ organizationId, membershipId: actor.membershipId }),
      getActiveShift({ actor, organizationId }),
    ]);
    return NextResponse.json({ ...participation, activeShift });
  } catch (error) {
    return handleRouteError(error);
  }
}
