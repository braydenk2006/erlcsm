import { NextResponse } from "next/server";
import { getErlcClientForOrganization, getErlcIntegration } from "@commandry/integrations";
import { requireActiveOrganization } from "@/lib/organization";
import { requireFeature } from "@/lib/entitlements";
import { handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Aggregate live-server snapshot powering the Live Server dashboard:
 * status, players (teams/callsigns/wanted/vehicles/locations), vehicles,
 * queue, join/leave logs, kill logs, command logs, and emergency calls.
 * Degrades gracefully: transport errors are returned as a typed outage payload.
 */
export async function GET() {
  try {
    const { organizationId } = await requireActiveOrganization();
    await requireFeature(organizationId, "server.live_status");
    const [{ client, mode, hasCredentials }, integration] = await Promise.all([
      getErlcClientForOrganization(organizationId),
      getErlcIntegration(organizationId),
    ]);

    try {
      const snapshot = await client.getSnapshot();
      return NextResponse.json({
        ok: true,
        mode,
        hasCredentials,
        integration,
        snapshot,
      });
    } catch (transportError) {
      // Graceful outage handling — surface a degraded payload instead of 5xx so
      // the dashboard can show an outage banner without losing the shell.
      const message =
        transportError instanceof Error ? transportError.message : "ER:LC service unavailable";
      return NextResponse.json({
        ok: false,
        mode,
        hasCredentials,
        integration,
        snapshot: null,
        outage: { message },
      });
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
