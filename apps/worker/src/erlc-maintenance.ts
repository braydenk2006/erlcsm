import { prisma } from "@commandry/database";
import { checkErlcHealth, correlatePlayerHistory } from "@commandry/integrations";
import { createLogger } from "@commandry/observability";

const log = createLogger({ service: "worker" });

/**
 * Background ER:LC maintenance for every org that has connected credentials:
 *  - integration-health monitoring (persists CONNECTED/DEGRADED/ERROR),
 *  - player-history correlation (roll up presence, link Roblox identities).
 * Both dedupe by stable id, so running them on a cadence is safe. CAD call
 * synchronization is intentionally on-demand (dispatcher-triggered) rather than
 * periodic, so we don't import an unbounded stream of 911 calls in the
 * background. Each org is isolated so one failure never blocks the rest.
 */
export async function runErlcMaintenance(): Promise<{ organizations: number }> {
  const credentials = await prisma.integrationCredential.findMany({
    where: { provider: "erlc" },
    select: { organizationId: true },
  });

  for (const { organizationId } of credentials) {
    try {
      const health = await checkErlcHealth(organizationId);
      const history = await correlatePlayerHistory(organizationId);
      log.info("ER:LC maintenance completed", {
        organizationId,
        status: health.status,
        playersTracked: history.tracked,
        playersCorrelated: history.correlated,
      });
    } catch (error) {
      log.error("ER:LC maintenance failed for organization", {
        organizationId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return { organizations: credentials.length };
}
