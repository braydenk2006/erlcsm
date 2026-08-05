import { NextResponse } from "next/server";
import { listPlayerHistory } from "@commandry/integrations";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Player-history correlation rows for the CAD Personnel panel. */
export async function GET() {
  try {
    const { organizationId } = await requireActiveOrganization();
    return NextResponse.json({ history: await listPlayerHistory(organizationId) });
  } catch (error) {
    return handleRouteError(error);
  }
}
