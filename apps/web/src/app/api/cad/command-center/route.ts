import { NextResponse } from "next/server";
import { getCadSummary, listCalls, listUnits } from "@commandry/cad";
import { getErlcClientForOrganization } from "@commandry/integrations";
import { requireCadPermission } from "@/lib/cad-auth";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * CAD Command Center: a CAD-module operational overview. Composes CAD data with
 * the shared ER:LC integration (live status via `@commandry/integrations`).
 * Live data degrades gracefully to `null` on outage. This view lives only inside
 * the CAD module and does not replace the main Ordinex dashboard.
 */
export async function GET() {
  try {
    const { organizationId } = await requireCadPermission("cad.access");

    const [summary, calls, units] = await Promise.all([
      getCadSummary(organizationId),
      listCalls(organizationId),
      listUnits(organizationId),
    ]);

    let live: {
      mode: string;
      connected: boolean;
      name: string;
      players: number;
      maxPlayers: number;
      region: string | null;
      message: string;
    } | null = null;
    try {
      const { client, mode } = await getErlcClientForOrganization(organizationId);
      const [status, players] = await Promise.all([client.getServerStatus(), client.getPlayers()]);
      live = {
        mode,
        connected: status.connected,
        name: status.name,
        players: players.length,
        maxPlayers: status.maxPlayers,
        region: status.region,
        message: status.message,
      };
    } catch {
      live = null;
    }

    const priorityBuckets = [1, 2, 3, 4, 5].map((priority) => ({
      priority,
      count: calls.filter((call) => call.priority === priority).length,
    }));

    return NextResponse.json({
      summary,
      live,
      calls: calls.slice(0, 12),
      units,
      availableUnits: units.filter((unit) => unit.status === "AVAILABLE").length,
      busyUnits: units.filter((unit) => unit.status !== "AVAILABLE").length,
      priorityBuckets,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
