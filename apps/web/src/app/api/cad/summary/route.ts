import { NextResponse } from "next/server";
import { getCadSummary } from "@commandry/cad";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { organizationId } = await requireActiveOrganization();
    const summary = await getCadSummary(organizationId);
    return NextResponse.json({ summary });
  } catch (error) {
    return handleRouteError(error);
  }
}
