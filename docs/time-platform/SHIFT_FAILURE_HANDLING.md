# Scheduled-Shift Failure & Outage Handling

The scheduling system stays functional during external outages.

## Discord outage

- The scheduled shift is preserved.
- Publication is marked `PARTIAL` or `FAILED` (never silently "successful").
- Retry is safe and idempotent via stored message/event IDs — no duplicate messages or events.
- The failure is visible in the shift's Discord state + timeline.

## PRC outage

- The live shift is preserved; `prcSyncState` is set to `STALE`.
- Attendance falls back to manual entry — no one is marked absent by an outage.
- Synchronization resumes automatically when the service returns (the worker keeps polling active
  shifts).

## Worker outage

All maintenance jobs are idempotent and reconcile on recovery:

- **Recurrence** — `generateRecurrenceOccurrences` re-extends within the horizon; the
  `(recurrenceId, scheduledStart)` unique constraint prevents duplicate occurrences.
- **Reminders** — deduplicated per `(shift, offset)` with `lastRemindedOffset`; missed reminders are
  sent on the next run without duplicates.
- **PRC** — `syncActiveShiftsPrc` simply resumes for active shifts.
- **Missed shifts** — `reconcileMissedShifts` marks un-started shifts past the grace window as
  `MISSED` and notifies managers (deduped).

## Data integrity & concurrency

- Single-host claim via conditional `updateMany` + `version` (optimistic concurrency).
- Idempotent Discord publication + scheduled-event creation via stored external IDs.
- Idempotent PRC ingestion via `(scheduledShiftId, robloxUserId)` unique + accrued presence.
- Attendance uniqueness via `(contextType, contextId, membershipId)`.
- Completing an active shift transitions status once; a second complete is rejected
  (`status !== ACTIVE`).
- Editing a completed shift is blocked (amendment workflow is a documented follow-up).

## Missed / unstaffed shifts

No-host and un-started shifts are surfaced as unstaffed warnings on the Schedule page, escalated to
managers via notification, and marked `MISSED` after the grace window. Staff are never automatically
punished.
