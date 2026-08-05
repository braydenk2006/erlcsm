import { NextResponse } from "next/server";
import { getOrgAnalytics } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "activity.tracking");
    const periodDays = Number(new URL(request.url).searchParams.get("days")) || 7;
    const analytics = await getOrgAnalytics({ actor, organizationId, periodDays });
    return NextResponse.json({ analytics });
  } catch (error) {
    return handleRouteError(error);
  }
}
