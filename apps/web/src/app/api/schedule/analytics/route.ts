import { NextResponse } from "next/server";
import { getSchedulingAnalytics } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "shifts.tracking");
    const analytics = await getSchedulingAnalytics({ actor, organizationId });
    return NextResponse.json({ analytics });
  } catch (error) {
    return handleRouteError(error);
  }
}
