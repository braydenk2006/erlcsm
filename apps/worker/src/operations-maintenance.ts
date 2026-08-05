import { autoCloseStaleShifts } from "@commandry/api";
import { createLogger } from "@commandry/observability";

const log = createLogger({ service: "worker" });

/** Auto-close shifts left running past each org's maximum duration. */
export async function runOperationsMaintenance() {
  const closed = await autoCloseStaleShifts();
  if (closed > 0) log.info("Auto-closed stale shifts", { closed });
  return { ok: true as const, closed };
}
