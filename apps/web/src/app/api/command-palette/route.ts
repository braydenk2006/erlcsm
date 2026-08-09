import { NextResponse } from "next/server";
import { getPaletteContext, searchCommandPalette } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const [context, results] = await Promise.all([
      getPaletteContext({ actor, organizationId }),
      q.trim().length >= 2
        ? searchCommandPalette({ actor, organizationId, query: q })
        : Promise.resolve([]),
    ]);
    return NextResponse.json({ ...context, results });
  } catch (error) {
    return handleRouteError(error);
  }
}
