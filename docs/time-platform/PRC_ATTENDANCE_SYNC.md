# PRC Attendance Synchronization

Uses the **existing** shared ER:LC/PRC integration (`getErlcClientForOrganization`) — no duplicate
PRC client, and no invented PRC fields. The owner-created scheduled shift stays authoritative; PRC
data only supplements it.

## Behavior

While a shift is `ACTIVE` with an ER:LC server, the worker (`syncActiveShiftsPrc`) periodically
pulls supported live data (current players, Roblox IDs, teams, callsigns) and correlates Roblox IDs
with linked `RobloxIdentity` records. Matches are stored in `PrcPresenceMatch` (first/last seen,
accrued presence minutes, team, callsign).

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
