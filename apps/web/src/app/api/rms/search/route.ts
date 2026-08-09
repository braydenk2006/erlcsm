import { NextResponse } from "next/server";
import { searchRms } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return NextResponse.json({ results: await searchRms({ actor, organizationId, query: q }) });
  } catch (error) {
    return handleRouteError(error);
  }
}
