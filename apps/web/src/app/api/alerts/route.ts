import { NextResponse } from "next/server";
import { listAlerts } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const status = new URL(request.url).searchParams.get("status") ?? undefined;
    return NextResponse.json({ alerts: await listAlerts({ actor, organizationId, status }) });
  } catch (error) {
    return handleRouteError(error);
  }
}
