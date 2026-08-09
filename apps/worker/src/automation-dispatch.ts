import { processQueuedRuns } from "@commandry/api";
import { createLogger } from "@commandry/observability";

const log = createLogger({ service: "worker" });

/** Durable automation execution: process due QUEUED/RETRYING runs with retry/backoff. */
export async function runAutomationDispatch() {
  const { processed } = await processQueuedRuns(50);
  if (processed > 0) log.info("Processed automation runs", { processed });
  return { ok: true as const, processed };
}
