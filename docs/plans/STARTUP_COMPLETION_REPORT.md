# Start-Up Completion Report

Honest status of the Start-Up plan after completing **Phase 2 (Core Organization Management)**.
Start-Up is **not yet fully complete** — Phases 3–9 remain and are listed below. Nothing advertised
as complete is faked; the public Plans page shows unbuilt Start-Up features as **Coming Soon**.

```text
START-UP CAPABILITIES:
- Total: 47
- Verified Complete: 27
- Partially Implemented: 11
- Missing: 9
- Unsafe: 0
- Simulator Only: 2 (server.locations, server.wanted_status — live PRC API has no data)
```

## FEATURES COMPLETED (Phase 3 — Identity)

- `roblox.account_linking` — profile-description verification challenge via the official public
  Roblox API (`@commandry/roblox` live client) with a deterministic mock adapter for dev/tests.
  Start → one-time `ORDINEX-` code → user adds it to their Roblox "About" → confirm. Enforces
  uniqueness (one Roblox account per Ordinex user), 15-minute expiry, safe unlink/relink, avatar +
  display name retrieval, audit, rate-limit/outage handling. No password, cookie, or scraping.
  Roblox group sync is intentionally NOT claimed. UI on `/app/settings`. 5 integration tests.

## FEATURES COMPLETED (Phase 2 — Core Organization Management)

- `core.members` — Members directory (`/app/staff`), search + status filter, invitations (create
  with `members.max` enforcement, resend, revoke, shareable link), role + department assignment,
  suspend/reactivate, soft removal (self-removal blocked), audit events, responsive UI.
- `core.departments` — Directory (`/app/departments`), create/edit/archive/restore,
  `departments.max` enforcement (verified 402 at 5), member counts + leaders, audit, responsive UI.
- `core.notifications` — `Notification` model, in-app bell (unread badge, mark one / mark all),
  API, dedupe, fan-out on announcement publish.
- `announcements.management` — `Announcement` model, draft/publish/archive, org- or
  department-targeting, pin, expiry, read tracking, notification fan-out, `announcement:read` vs
  `announcement:manage` permission split, audit, responsive UI.
- Matrix correction: `server.locations` and `server.wanted_status` reclassified Verified → Partial
  (simulator-only; the live PRC ER:LC API exposes no coordinates or wanted level).

## FEATURES STILL INCOMPLETE (Start-Up scope — NOT done in this task)

Missing (9):

- `shifts.tracking`, `activity.tracking`, `sessions.management` (Phase 4)
- `applications.basic`, `forms.basic`, `training.basic` (Phase 5)
- `website.builder` (Phase 6)
- `ai.report_summary`, `ai.application_summary` (Phase 7 — needs AI infrastructure)

Partial (11):

- `documents.basic`, `website.public_staff` (Phase 6)
- `cad.mdt`, `cad.incident_reports`, `cad.arrest_reports`, `cad.analytics.basic` (Phase 8)
- `core.mobile`, `core.pwa` (Phase 9)
- `discord.integration` (OAuth only), `server.locations`, `server.wanted_status` (simulator-only)

## LIVE ER:LC VERIFICATION

- Verified against the live PRC client (`packages/erlc/src/live-client.ts`): server status, players,
  teams, callsigns, vehicles, join/leave logs, kill logs, command logs, remote commands, health.
- **Simulator-only** (not live-verified): player locations/map and wanted stars — the PRC API
  returns no coordinates or wanted level. These are marked Partial, not Verified.

## MOBILE VERIFICATION

- New Core Org Management pages (Members, Departments, Announcements) use responsive layouts
  (stacked forms, horizontal-scroll tables, wrapping actions). Full responsive audit of every
  Start-Up workflow (Phase 9) is not complete.

## PWA VERIFICATION

- Web manifest present; installability partial. Service worker / offline app shell (Phase 9) is
  **not** implemented — offline functionality is not claimed.

## ENTITLEMENT VERIFICATION

- All new routes enforce feature entitlement + permission server-side. `members.max` (invite) and
  `departments.max` (create) return structured **402 LIMIT_EXCEEDED**. Verified in production and by
  integration tests.

## PLAN PAGE VERIFICATION

- Plans page + comparison table regenerate from the registry. Newly Verified capabilities (members,
  departments, notifications, announcements) now show as included; still-Missing Start-Up features
  render as **Coming Soon**. No manual Plans-page edits.

## TESTS RUN

- `pnpm format:check` / `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` / `pnpm quality`
  — all pass (37 lint/typecheck/test tasks; 48 build tasks).
- `@commandry/api` integration tests (real DB) — 5 pass: departments.max limit, department
  assignment, self-removal guard, announcement publish → notification fan-out, notification dedupe.
- Production run: members directory + invite (shareable link) + pending invitations; departments
  create/list + 402 at limit; announcement draft → publish; notification bell fan-out + mark-all.

## KNOWN LIMITATIONS

- Start-Up is **not** fully complete: Phases 4–9 (shifts, activity, sessions, applications, forms,
  training, documents, website builder, staff directory, Start-Up AI, dedicated MDT, incident/arrest
  report workflows, basic CAD analytics, PWA/offline) remain. Phases 2–3 are done.
- Roblox verification runs against a mock adapter in this environment (`ROBLOX_MODE` unset). Set
  `ROBLOX_MODE=live` in production to use the real public Roblox API.
- Invitations have no email delivery in this environment; the invite link is returned to the admin
  to share (magic-link style), consistent with the existing auth flow.
- Member/announcement author display name is blank for seed accounts whose `user.name` is empty
  (data seeding, not a code defect).

## RECOMMENDED NEXT PROMPTS

1. Phase 4 — Operational management: shifts + activity + sessions (shared time model).
2. Phase 5 — Recruitment & training: shared form foundation → applications + forms + training.
3. Phase 6 — Documents + website builder + public staff directory.
4. Phase 7 — Start-Up AI infrastructure (provider abstraction + usage metering) + report/application summaries.
5. Phase 8 — CAD Start-Up completion: dedicated MDT, incident/arrest report workflows, basic analytics.
6. Phase 9 — Mobile + PWA (service worker, offline shell, install).
