import { NextResponse } from "next/server";
import { listMembers, listOrganizationRoles } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { actor, organizationId } = await requireActor();
    const url = new URL(request.url);
    const [members, roles] = await Promise.all([
      listMembers({
        actor,
        organizationId,
        query: url.searchParams.get("q") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        departmentId: url.searchParams.get("departmentId") ?? undefined,
      }),
      listOrganizationRoles({ actor, organizationId }),
    ]);
    return NextResponse.json({ members, roles });
  } catch (error) {
    return handleRouteError(error);
  }
}
