import { NextResponse } from "next/server";
import { getCommandCenter } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Command Center aggregation — clean read-only snapshot for future dashboards.
export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    return NextResponse.json(await getCommandCenter({ actor, organizationId }));
  } catch (error) {
    return handleRouteError(error);
  }
}
