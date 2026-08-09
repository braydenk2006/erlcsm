import { processWebhookDeliveries } from "@commandry/api";
import { createLogger } from "@commandry/observability";

const log = createLogger({ service: "worker" });

/** Durable outgoing-webhook delivery: process due deliveries with retry/backoff. */
export async function runWebhookDispatch() {
  const { processed } = await processWebhookDeliveries(100);
  if (processed > 0) log.info("Processed webhook deliveries", { processed });
  return { ok: true as const, processed };
}
