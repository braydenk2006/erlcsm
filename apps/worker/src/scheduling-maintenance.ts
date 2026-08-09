import {
  generateRecurrenceOccurrences,
  reconcileMissedShifts,
  sendDueShiftReminders,
  syncActiveShiftsPrc,
} from "@commandry/api";
import { createLogger } from "@commandry/observability";

const log = createLogger({ service: "worker" });

/**
 * Scheduled-shift maintenance: extend recurrences within the horizon, send due
 * reminders, sync PRC presence for active shifts, and reconcile missed shifts.
 * Every step is idempotent and safe to re-run after a worker outage.
 */
export async function runSchedulingMaintenance() {
  const [recurrence, reminders, prc, missed] = await Promise.all([
    generateRecurrenceOccurrences().catch((e) => ({ created: 0, error: String(e) })),
    sendDueShiftReminders().catch((e) => ({ sent: 0, error: String(e) })),
    syncActiveShiftsPrc().catch((e) => ({ shifts: 0, error: String(e) })),
    reconcileMissedShifts().catch((e) => ({ missed: 0, error: String(e) })),
  ]);
  log.info("Scheduling maintenance complete", { recurrence, reminders, prc, missed });
  return { ok: true as const, recurrence, reminders, prc, missed };
}
