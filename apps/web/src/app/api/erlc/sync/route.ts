import { NextResponse } from "next/server";
import { correlatePlayerHistory, syncCadFromErlc } from "@commandry/integrations";
import { requireActiveOrganization } from "@/lib/organization";
import { handleRouteError } from "@/lib/api";

/**
 * Run CAD synchronization (emergency calls -> CAD entries) and player-history
 * correlation for the active org. Also invoked by the background worker.
 */
export async function POST() {
  try {
    const { organizationId } = await requireActiveOrganization();
    const [cad, history] = await Promise.all([
      syncCadFromErlc(organizationId),
      correlatePlayerHistory(organizationId),
    ]);
    return NextResponse.json({ ok: true, cad, history });
  } catch (error) {
    return handleRouteError(error);
  }
}
