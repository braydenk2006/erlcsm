import { NextResponse } from "next/server";
import { getCadSummary } from "@commandry/cad";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { organizationId } = await requireCadPermission("cad.access");
    const summary = await getCadSummary(organizationId);
    return NextResponse.json({ summary });
  } catch (error) {
    return handleRouteError(error);
  }
}
