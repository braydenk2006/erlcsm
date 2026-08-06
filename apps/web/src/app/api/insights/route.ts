import { NextResponse } from "next/server";
import { getInsightsBundle } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    return NextResponse.json(await getInsightsBundle({ actor, organizationId }));
  } catch (error) {
    return handleRouteError(error);
  }
}
