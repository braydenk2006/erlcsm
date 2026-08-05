# CAD/MDT — Completion Roadmap

Prioritized plan to complete the CAD/MDT without changing unrelated Ordinex modules.
Gating rule: **do not begin a milestone until the previous one passes** its exit criteria
(build + migrations + tests + regression green).

## Milestone 1 — Production stabilization (DONE in this PR)

- [x] Fix production build (lazy auth, dynamic `/app` segment, `NODE_ENV=production`,
      branded `global-error`). See `docs/BUILD_FAILURE_ROOT_CAUSE.md`.
- [x] `pnpm build` + `pnpm quality` pass (incl. worst-case dev-polluted env).
- [x] Production startup verified (web/worker/bot, DB, Redis, auth, org, CAD, ER:LC). See
      `docs/PRODUCTION_VERIFICATION.md`.
- [x] Migrations validated (additive; no data loss).
- [x] Regression suite green (35/35 tasks) — recorded baseline preserved.
- Immediate security hardening to fold in here (small, high value): enforce `erlc:command`
  on the remote-command route; return `404` on cross-tenant/not-found CAD mutations.
- Exit criteria: all above green + deployment notes.

## Milestone 2 — CAD foundations

- Final data model: record lifecycle (`status`/`revision`/`lockedAt`), warrant workflow
  `state`, `expiresAt` on warrants/BOLOs, history tables (unit/call/warrant status events),
  optimistic-lock/version columns, unique constraints (plate, active callsign).
- Tenant configuration tables replacing hard-coded constants: status codes, priorities, call
  types, dispositions, record types, warrant/BOLO types, number formats, penal code.
- Permission completion: department/agency/authored-record/rank/record-type scopes; remove
  CAD read from baseline `member` role.
- Audit coverage for all consequential CAD actions.
- Real-time infrastructure: tenant-isolated, permission-aware SSE/WebSocket channels with
  reconnection, ordering, dedup, and conflict handling.
- Search infrastructure: trigram/GIN indexes or search read-model; cursor pagination on all
  lists.
- Exit criteria: build/quality/regression green; tenant-config + real-time smoke tests pass.

## Milestone 3 — Dispatch & units

- Full dispatcher workflow: reassign/remove/recommend units, priority change, dispositions,
  transfer/merge/split, mutual aid, reopen, dispatcher handoff, supervisor view, saved
  layouts, keyboard shortcuts, configurable audible/visual alerts, response-time reporting.
- Unit lifecycle: member-linked units (Ordinex membership), partners/supervisors, apparatus,
  vehicle/equipment/certifications, callsign validation, status history, shift/session
  integration, panic workflow, offline/stale handling, auto-unit-from-live-players.
- Multi-agency support and ER:LC sync (dedup, moderator-call integration, stale-call
  reconciliation, coordinates on map).
- Concurrent-use testing (multiple dispatchers/units).
- Exit criteria: E2E dispatch + concurrency tests pass.

## Milestone 4 — MDT & records

- Complete mobile/PWA MDT (assigned-call, quick actions, lookups, recent/favorites, offline
  drafts).
- Complete records lifecycle: draft→submit→review→revision→approve/reject→lock→archive with
  immutable approved history + amendments, multiple authors, signatures/attestations,
  attachments, record numbering, configurable fields/types, PDF/print, related entities,
  search indexing.
- Exit criteria: full record review E2E + mobile MDT tests pass.

## Milestone 5 — Warrants, BOLOs & evidence

- Full warrant lifecycle (types, PC narrative, scope, review/approve/deny, active, service,
  recall, expire, dismiss, notifications, history) + automatic expiration worker + downtime
  reconciliation.
- Full BOLO lifecycle (subtypes, priority, expiry, acknowledgment, match alerts in
  MDT/dispatch, linked reports, status history, auto-expiration).
- Evidence + append-only chain of custody (IDs, media, collector/time/location, storage,
  seal, check-in/out, transfers, release, destruction, related reports/cases, audit).
- Exit criteria: expiration workers + evidence chain-of-custody tests pass.

## Milestone 6 — Civilian, Fire/EMS & Court

- Civilian portal (characters/vehicles/plates/addresses/businesses/licenses/permits/insurance/
  emergency calls/permitted court views) with strict permission separation — civilian access
  never grants privileged CAD access.
- Fire/EMS workflows (units/apparatus/stations/incidents/PCR/transports/facilities/hazmat/
  rescue/mutual aid/medical-privacy permissions/certifications).
- Court workflows (cases/judges/prosecutors/defense/defendants/charges/evidence/hearings/
  scheduling/motions/verdicts/sentences/appeals/public-vs-restricted).
- Exit criteria: permission-separation + workflow E2E tests pass.

## Milestone 7 — Analytics & AI assistance

- CAD analytics: response times, unit activity, report metrics (permission-aware).
- AI (shared Ordinex AI framework only): summarize call/report/evidence, draft narrative/BOLO/
  warrant-request, find related records, NL search, case timeline, penal-code explanation. AI
  never approves/issues/executes; output labeled, reviewable, permission-aware, audited.
- Exit criteria: AI safety + analytics tests pass.

## Milestone 8 — Scale & release

- Load testing (concurrent dispatchers/units, 100k-record search), accessibility, security
  review, mobile testing, migration testing (dry-run/reconcile/rollback), staged rollout via
  the `CadSettings` v1/v2 flag, rollback test, legacy retirement.
- Exit criteria: performance/accessibility/security/migration gates pass; rollback tested.

## Cross-cutting invariants (every milestone)

Server-side authorization on all mutations; org scoping on every query; append-only for
approved records + evidence; AI never approves/issues/executes; no browser-exposed
credentials; no business logic in React components; full regression green.
