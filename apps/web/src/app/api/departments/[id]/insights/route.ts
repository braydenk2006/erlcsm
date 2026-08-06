import { NextResponse } from "next/server";
import { getDepartmentInsights } from "@commandry/api";
import { requireActor } from "@/lib/actor";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, organizationId } = await requireActor();
    const { id } = await params;
    return NextResponse.json(
      await getDepartmentInsights({ actor, organizationId, departmentId: id }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
