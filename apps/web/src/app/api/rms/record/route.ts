import { NextResponse } from "next/server";
import { getRelationships, getTimeline } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Unified record view: relationships + timeline for any RMS record.
export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const id = url.searchParams.get("id");
    if (!type || !id) throw new ValidationError("Missing type/id");
    const [relationships, timeline] = await Promise.all([
      getRelationships({ actor, organizationId, type, id }),
      getTimeline({ actor, organizationId, type, id }),
    ]);
    return NextResponse.json({ relationships, timeline });
  } catch (error) {
    return handleRouteError(error);
  }
}
