import { NextResponse } from "next/server";
import { getInsightsBundle } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    const bundle = await getInsightsBundle({ actor, organizationId });
    return NextResponse.json({ kpis: bundle.kpis });
  } catch (error) {
    return handleRouteError(error);
  }
}
