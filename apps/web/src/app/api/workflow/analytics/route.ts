import { NextResponse } from "next/server";
import { getWorkflowAnalytics } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "forms.basic");
    const analytics = await getWorkflowAnalytics({ actor, organizationId });
    return NextResponse.json({ analytics });
  } catch (error) {
    return handleRouteError(error);
  }
}
