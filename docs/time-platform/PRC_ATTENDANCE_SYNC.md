# PRC Attendance Synchronization

Uses the **existing** shared ER:LC/PRC integration (`getErlcClientForOrganization`) — no duplicate
PRC client, and no invented PRC fields. The owner-created scheduled shift stays authoritative; PRC
data only supplements it.

## Behavior

While a shift is `ACTIVE` with an ER:LC server, the worker (`syncActiveShiftsPrc`) periodically
pulls supported live data (current players, Roblox IDs, teams, callsigns) and correlates Roblox IDs
with linked `RobloxIdentity` records. For each linked player it opens/closes **presence intervals**
(`PresenceInterval`) — the authoritative source of logged minutes.

## Verified logged minutes (authoritative)

Logged/activity minutes are derived **only** from verified private-server presence intervals,
computed server-side. The scheduled duration, attendance status, Discord participation, page
activity, and manual check-in never award minutes.

- Interval-based: each disconnect/rejoin is a separate interval; overlaps are merged (no
  double-count); gaps within the configured reconnection tolerance are joined.
- Exact seconds are summed first, clamped to the allowed window (scheduled/actual start ± grace),
  then the org rounding policy is applied for display (`computeLoggedMinutes`). Storage is exact.
- A minimum-presence gate and a max-countable cap are applied. Example: present 6:08–6:47 (39m) +
  6:55–7:42 (47m) → **86 logged minutes**, not the 120-minute scheduled shift.
- On completion, `finalizeShiftLoggedMinutes` writes `ShiftLoggedMinutes` (automatic + adjustment =
  final) and emits one `SHIFT_COMPLETED` participation event per member with `durationMinutes =
final` — credited to the shared activity ledger **exactly once** (stable `sourceId`).

**Attendance status is separate from logged minutes.** A member may be Present with 42 logged
minutes; Excused with 0. Only eligible-team presence counts; ineligible-team intervals are recorded
but excluded from minutes unless an authorized host approves an exception.

## Manual adjustments & corrections

Managers (`shifts.attendance.override`) adjust final minutes without overwriting the automatic
calculation (`ShiftLoggedMinutes` stores automatic + adjustment + final); post-completion
adjustments emit a `MANUAL_ADJUSTMENT` delta so activity stays correct. Staff can submit correction
requests (`CorrectionRequest`) which reviewers approve/partial/deny/ask-info; approvals apply through
the same adjustment path. All are audited.

## Policies (default: SUGGEST_ONLY)

- **SUGGEST_ONLY** — presence appears as a suggestion; the host confirms.
- **AUTO_CHECKIN** — presence records a check-in; the host confirms completion.
- **AUTO_PRESENT** — a linked eligible member is marked present after the minimum presence duration.
- **DISABLED** — no attendance is derived from PRC.

`prcAttendanceDecision` (pure) applies the policy + a minimum-presence threshold.

## Safeguards

- A player with **no linked Roblox identity is never matched by username alone**.
- Below the minimum presence duration, no auto-present (a 30-second join earns nothing).
- Rejoins keep **one** attendance record (unique `(scheduledShiftId, robloxUserId)`; presence
  accrues rather than duplicating).
- A **PRC outage** sets `prcSyncState = STALE`, preserves the shift, and leaves attendance to manual
  entry — it never marks everyone absent.
- **Manual attendance always takes precedence** — automated sync skips records with a human
  `recordedByUserId`.

## Persistence + retention

`PrcPresenceMatch` stores first/last seen, presence minutes, team, callsign, correlation result, and
sync timestamps with idempotent upserts (no unbounded high-frequency snapshots). `ErlcPlayerSession`
continues to hold rolled-up player history.

## Known API limitations

The live PRC API exposes no player coordinates or wanted level; presence is derived from the player
list + join/leave, not positions. See `docs/plans/STARTUP_COMPLETION_BASELINE.md`.

## Test tier

**Simulator-tested** (correlation, suggest-only default, auto-present after threshold, manual
precedence, unlinked-not-matched). **Not live-verified** in this environment (no real ER:LC server
key). Set `ERLC_MODE=live` + credentials for live operation.
