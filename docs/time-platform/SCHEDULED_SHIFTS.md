# Scheduled Shifts

Scheduled shifts extend the Phase 4 Operational Time Platform. The owner-created
`ScheduledShift` is the **authoritative** record; the calendar, Discord message/event, PRC
presence, attendance, and the shift timeline all reference that one record — there is no separate
calendar, attendance, or Discord model.

## Architecture

```
ScheduledShift (authoritative)
├── ShiftClaim            (claim requests + history)
├── AttendanceRecord      (shared engine, contextType="scheduled_shift")
├── ScheduledShiftEvent   (ONE shift timeline: lifecycle + Discord + PRC + attendance)
├── PrcPresenceMatch      (PRC correlation, suggest-only by default)
├── ParticipationEvent    (shared activity ledger — credit emitted on completion)
├── discord* fields       (channel/message/event IDs + state)
└── ShiftRecurrence       (bounded recurrence generation)
```

- Domain (pure): `@commandry/operations/scheduling` — status lifecycle + transitions, eligibility,
  conflict detection, safe Discord template rendering, PRC presence decisions, recurrence occurrence
  generation. Unit-tested.
- Service: `@commandry/api/operations/scheduling` (+ `scheduling-jobs` for workers).
- Persistence uses UTC; the org timezone is stored for display.

## Status lifecycle

`DRAFT → OPEN_CLAIMING → (AWAITING_APPROVAL) → CLAIMED → (SCHEDULED) → PUBLISHED → (STARTING) →
ACTIVE → COMPLETED`, plus `CANCELLED`, `NO_HOST`, `MISSED`, `ARCHIVED`. All transitions are validated
server-side by `canTransitionScheduledShift`. Examples enforced: a completed shift cannot be
claimed; a cancelled shift cannot be started; publish requires a host unless
`allowPublishWithoutHost`; a Discord event is only created on publish (never for a draft); starting
before the start window requires an authorized override.

## Data model highlights

Organization, title/description, shift type, department, ER:LC server, timezone, scheduled
start/end, capacity, required host/staff counts, eligibility (min rank, required permission/
department), claim/attendance/PRC policies, host + co-hosts, claimed/published/actual timestamps,
cancellation reason, completion notes, Discord channel/message/event IDs + state, PRC sync state,
`version` (optimistic concurrency), created/updated by, and the shift timeline.

## APIs

- `GET/POST /api/schedule` — calendar range list (filters: from/to/status/department/mine) + create.
- `GET/PATCH /api/schedule/[id]` — detail + all actions (open_claiming, claim, withdraw,
  decide_claim, assign_host, publish, start, attendance, prc_sync, complete, cancel).
- `GET /api/schedule/analytics` — scheduling + attendance metrics from the shared platform.

## Entitlements

Start-Up: `shifts.tracking` (scheduling + claiming + publish + attendance + supported PRC sync) and
`activity.tracking` (activity credit). No Growth-only gate inside the Start-Up interface.

## Test tiers

Unit-tested (domain) and integration-tested (real DB) for the full workflow, single-host claiming,
Discord idempotency, and PRC correlation. Discord is **mock-adapter tested** and PRC is
**simulator-tested** in this environment — see the respective docs. Neither is live-verified here.
