import { NextResponse } from "next/server";
import { listCollections } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, organizationId } = await requireActor();
    return NextResponse.json({ collections: await listCollections({ actor, organizationId }) });
  } catch (error) {
    return handleRouteError(error);
  }
}
