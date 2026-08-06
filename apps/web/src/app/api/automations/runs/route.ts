import { NextResponse } from "next/server";
import { getAutomationAnalytics, listRuns, processQueuedRuns } from "@commandry/api";
import { authorize } from "@commandry/permissions";
import { ForbiddenError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "automations.builder");
    const [runs, analytics] = await Promise.all([
      listRuns({ actor, organizationId }),
      getAutomationAnalytics({ actor, organizationId }),
    ]);
    return NextResponse.json({ runs, analytics });
  } catch (error) {
    return handleRouteError(error);
  }
}

// Manually dispatch due runs (the worker also does this on a cadence).
export async function POST() {
  try {
    const { actor, organizationId } = await requireActor();
    await requireFeature(organizationId, "automations.builder");
    if (!authorize({ actor, organizationId, action: "automation.execute" }).allowed) {
      throw new ForbiddenError("Not permitted");
    }
    const result = await processQueuedRuns(50);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
