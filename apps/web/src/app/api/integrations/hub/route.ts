import { NextResponse } from "next/server";
import { getIntegrationActivity, getIntegrationHub } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    const [hub, activity] = await Promise.all([
      getIntegrationHub({ actor, organizationId }),
      getIntegrationActivity({ actor, organizationId }).catch(() => []),
    ]);
    return NextResponse.json({ ...hub, activity });
  } catch (error) {
    return handleRouteError(error);
  }
}
