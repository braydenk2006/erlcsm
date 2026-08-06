import { NextResponse } from "next/server";
import { compareVersions } from "@commandry/api";
import { ValidationError } from "@commandry/shared";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    const url = new URL(request.url);
    const a = Number(url.searchParams.get("a"));
    const b = Number(url.searchParams.get("b"));
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new ValidationError("Invalid versions");
    return NextResponse.json(
      await compareVersions({ actor, organizationId, id, versionA: a, versionB: b }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
