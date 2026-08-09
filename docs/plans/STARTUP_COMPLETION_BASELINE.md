# Start-Up Completion — Baseline (Phase 1)

Recorded before implementing Start-Up completion work. Source of truth: the entitlement registry
(`@commandry/entitlements`) and the feature-verification matrix.

## Matrix baseline (before this task)

- Total capabilities: 125
- Verified Complete: 26
- Partially Implemented: 12
- Coming Soon: 4
- Missing: 83

## Corrections made during revalidation

Re-inspecting every Start-Up capability surfaced two overstatements that were corrected in
`verification.ts` (the single source of truth):

| Capability                                  | Was      | Now         | Reason                                                                                                                                                                                                                 |
| ------------------------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server.locations` (player locations & map) | Verified | **Partial** | The live PRC ER:LC API returns **no per-player coordinates** (`live-client.ts` sets `location` to nulls). The map works only with the simulator. Simulator-only behavior must not be presented as production-complete. |
| `server.wanted_status` (wanted stars)       | Verified | **Partial** | The live PRC ER:LC API returns **no per-player wanted level** (`wantedStars: null` in live mode). Simulator-only.                                                                                                      |

All other server tools (status, players, teams, callsigns, vehicles, join/leave, kill, command
logs, remote commands, health, player history) are genuinely backed by the live PRC API and remain
Verified.

## Start-Up capability baseline (accurate status at start)

Verified at baseline: organizations, basic permissions, basic audit, the live ER:LC tool suite
(minus locations/wanted), player history, and the CAD core (access, dispatch, people, vehicles,
citations, warnings, warrants, BOLOs, penal code, report approvals).

Not yet complete at baseline (Start-Up scope): members (partial), departments (partial),
notifications (missing), announcements (missing), Roblox linking (missing), shifts (missing),
activity (missing), sessions (missing), applications (missing), forms (missing), training (missing),
documents (partial/schema), website builder (missing), public staff directory (partial/scaffold),
Start-Up AI infrastructure + report/application summaries (missing), dedicated MDT (partial),
incident/arrest reports (partial), basic CAD analytics (partial), PWA/offline (partial).

## Delivered in this task

**Phase 2 — Core Organization Management** completed to Verified:

- `core.members` — member directory (search/status filter), invitations (create with `members.max`
  enforcement, resend, revoke), per-member role + department assignment, status (suspend/reactivate),
  soft removal (self-removal blocked), audit events, responsive UI. Integration-tested.
- `core.departments` — directory + create/edit/archive/restore, `departments.max` enforcement,
  member counts + leaders, audit events, responsive UI. Integration-tested.
- `core.notifications` — `Notification` model, in-app bell (unread badge, mark one / mark all,
  polling), API, dedupe, fan-out on announcement publish. Integration-tested.
- `announcements.management` — `Announcement` model, draft/publish/archive, org- or
  department-targeting, pin, expiry, read tracking, notification fan-out, permission split
  (`announcement:manage` vs `announcement:read`), audit events, responsive UI. Integration-tested.

Remaining Start-Up phases (3–9) are **not** completed in this task and are honestly reported in
`STARTUP_COMPLETION_REPORT.md` and `MISSING_FEATURES_REPORT.md`.
