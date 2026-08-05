# Operational Time Platform (Phase 4)

A shared time & participation engine. Shifts, sessions, attendance, activity, metrics, history,
notifications, and analytics are **not** independent modules — they are consumers of one
append-only participation ledger. Every future participation source plugs into the same engine
without rewriting time logic.

## 1. Architecture

```
Operational Time Platform
├── ParticipationEvent ledger  (single source of truth, append-only)
├── Shift Engine               → emits events
├── Session Engine             → emits events
├── Attendance Engine          → emits events (generic: session/training/meeting/…)
├── Activity Engine / Metrics  → derives from events (never stored totals)
├── Participation History      → one chronological timeline from events
├── Notifications              → emitted on lifecycle transitions
└── Analytics                  → aggregates the ledger
```

- Pure domain: **`@commandry/operations`** — event types + `EVENT_META` (category + `credit` flag),
  attendance/shift/session status vocabularies + transitions, and pure calculators
  (`computeActiveMinutes`, `computeMetrics`, `computeAttendanceStats`, `complianceStatus`,
  `buildTimeline`). No DB, fully unit-tested.
- Persistence: `ParticipationEvent` (ledger) + `Shift`, `OperationalSession`, `AttendanceRecord`
  (generic via `contextType`/`contextId`), `OperationsSettings`.
- Services: `@commandry/api/operations/*` — `participation` (the only ledger writer + metrics +
  history + settings), `shifts`, `sessions`, `attendance`, `analytics`.

The golden rule: **only `recordParticipationEvent` writes activity-bearing data.** Shift/session/
attendance engines call it; they never compute or store their own activity totals.

## 2. Services that consume the platform

| Consumer              | How it uses the platform                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Shift Engine          | Emits `SHIFT_STARTED`/`BREAK_*`/`SHIFT_ENDED` and a credit `SHIFT_COMPLETED` (duration = active minutes) |
| Session Engine        | Lifecycle `SESSION_*`; on completion emits `SESSION_ATTENDED` (per attendee) + `SESSION_HOSTED`          |
| Attendance Engine     | Upserts `AttendanceRecord` and emits `ATTENDANCE_RECORDED`; reusable by any context                      |
| Activity / Metrics    | `computeMetrics` over ledger events — no manual totals                                                   |
| Participation History | `buildTimeline` over ledger events                                                                       |
| Analytics             | Aggregates ledger events org-wide (totals + leaderboard)                                                 |
| Notifications         | Emitted on shift end, session open, stale-shift auto-close                                               |
| Stale-shift worker    | `autoCloseStaleShifts` ends over-long shifts, emitting the same ledger events                            |

## 3. Future modules that reuse it (no rewrite required)

Training, Certifications, Applications, Performance Reviews, Promotion Boards, Awards,
Leaderboards, Leave Requests, Automation, AI, CAD Duty Tracking. Each either (a) adds a new
`ParticipationEventType` with one `EVENT_META` entry to contribute activity credit, and/or (b)
records attendance through the generic engine with a new `contextType` (e.g. `training`). Metrics,
history, analytics, and notifications pick it up automatically.

## 4. Centralized calculations

All in `@commandry/operations` (one implementation each):
`minutesBetween`, `computeActiveMinutes` (elapsed − breaks), `computeMetrics` (active/shift/break/
session/adjustment minutes, completed shifts, sessions attended, sessions hosted, averages),
`computeAttendanceStats` (attendance % and late %), `complianceStatus` (met / at_risk / below),
`buildTimeline`. No feature recomputes these.

## 5. Events emitted

`SHIFT_STARTED`, `BREAK_STARTED`, `BREAK_ENDED`, `SHIFT_ENDED`, `SHIFT_COMPLETED` (credit),
`SESSION_SCHEDULED`, `SESSION_OPENED`, `SESSION_STARTED`, `SESSION_COMPLETED`,
`SESSION_ATTENDED` (credit), `SESSION_HOSTED`, `ATTENDANCE_RECORDED`, `MANUAL_ADJUSTMENT` (credit).
`credit: true` events carry `durationMinutes` that contributes to active time. Notifications are
emitted for shift-ended, session-open (fan-out to members), and stale-shift auto-close.

## 6. APIs exposing participation data

- `GET /api/activity` — the caller's metrics + compliance + participation timeline + active shift.
- `POST /api/shifts` — `start` / `break` / `resume` / `end`; `GET` returns active + recent shifts.
- `GET/POST /api/sessions`, `GET/PATCH /api/sessions/[id]` — lifecycle transitions, self-register,
  manager attendance marking; detail returns attendance.
- `GET /api/analytics/operations` — org totals + activity leaderboard (aggregated from the ledger).

All routes enforce authentication, membership, entitlement (`shifts.tracking` / `sessions.management`
/ `activity.tracking`), permission, and tenant ownership server-side.

## 7. Why this eliminates duplicated business logic

There is exactly one ledger, one attendance model, one activity definition, one calculation engine,
one event vocabulary, and one history timeline. Adding a participation source is a config-level
change (a new event type + optional attendance context), not new time math. Sessions, shifts, and
activity cannot drift because they read the same events; analytics and metrics cannot disagree
because they call the same pure functions. Future features (training, promotions, awards, AI,
CAD duty tracking) stand on this foundation instead of reimplementing participation tracking.
