# Shift Attendance

Attendance uses the **shared Attendance Engine** (`AttendanceRecord`, `contextType =
"scheduled_shift"`) — the same engine sessions use, and the one training/meetings will reuse. No
duplicate attendance logic.

## Statuses

`REGISTERED`, `PRESENT`, `LATE`, `EXCUSED`, `LEFT_EARLY`, `ABSENT`, `REMOVED`. Present / late /
left-early count as attended and earn activity credit on completion.

## Sources + precedence

Each record retains its source. `recordedByUserId` distinguishes **manual** (a human host/manager)
from **automated** (PRC/self-check-in). Automated processes never overwrite a manually confirmed
record — the PRC sync explicitly skips any record with a non-null `recordedByUserId`. A manual host
decision always wins.

## Recording

Hosts/managers (`shifts.attendance.manage`) mark present/late/excused/absent/left-early/removed, set
minutes, and add attendees. On completion, each attended record emits a `SHIFT_COMPLETED`
participation event into the shared ledger (duration = recorded minutes or the shift duration), so
activity, metrics, history, and analytics update from one source.

## Completion

`completeScheduledShift` sets the actual end, credits host + present attendees to the shared ledger,
completes the Discord event where supported, writes `SHIFT_COMPLETED`/`SHIFT_SUMMARY` to the shift
timeline, and audits. Attendance is closed by the status transition to `COMPLETED`.

## Test tier

Integration-tested (manual marking, completion credit, PRC auto-present with manual precedence).
Self-check-in and bulk marking are partially implemented (see the completion report).
