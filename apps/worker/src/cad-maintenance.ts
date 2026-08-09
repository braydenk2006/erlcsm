import { expireOverdueBolos, expireOverdueWarrants } from "@commandry/cad";
import { createLogger } from "@commandry/observability";

const log = createLogger({ service: "worker" });

/**
 * Auto-expire overdue CAD warrants and BOLOs across all organizations.
 * Idempotent and stateless, so it also reconciles anything missed during
 * worker downtime on the next run.
 */
export async function runCadExpiration(): Promise<{ warrants: number; bolos: number }> {
  const warrants = await expireOverdueWarrants();
  const bolos = await expireOverdueBolos();
  if (warrants > 0 || bolos > 0) {
    log.info("CAD expiration completed", { warrants, bolos });
  }
  return { warrants, bolos };
}
