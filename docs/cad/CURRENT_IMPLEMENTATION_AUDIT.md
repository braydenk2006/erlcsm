# CAD/MDT — Current Implementation Audit (post-M1)

Audit of what is actually built, with evidence. Companion to `FEATURE_GAP_MATRIX.md`.

## Code surface

- Package `@commandry/cad`:
  - `domain/` — pure state machines + helpers: `unit-status`, `call-status` (+ response-time
    metrics), `call-number`, `workflow` (report + warrant state machines), `expiration`.
    **Tested** (`domain/domain.test.ts`, 9 tests). **Not yet wired** to persistence for
    records/warrants (see gaps).
  - `application/` — `settings` (feature flag + atomic call-number allocator), `agencies`.
  - `service.ts` — org-scoped services: units, calls (+assignment, +logs), civilians,
    vehicles, warrants, records, bolos, summary.
  - `penal-code.ts` — hard-coded 25-charge catalogue.
- API: `apps/web/src/app/api/cad/**` (17 route files) + CAD-adjacent `api/erlc/{sync,history}`.
- UI: `apps/web/src/app/app/cad/page.tsx` → `components/cad/cad-workspace.tsx` with
  Command / Dispatch / Persons / Vehicles / Warrants / BOLOs / Personnel / Configuration.
- Worker: `erlc.maintenance` (health + player-history; CAD call sync is on-demand).

## Prisma models

`CadCall` (+`CadCallUnit`, `CadCallLog`), `CadUnit`, `CadCivilian`, `CadVehicle`,
`CadWarrant`, `CadRecord`, `CadBolo`, `CadAgency`, `CadSettings`. Migrations:
`cad_mdt_system`, `cad_v2_foundation` (additive).

## What works (verified end-to-end)

- Dispatch: create call (auto call number), assign/unassign units (unit→EN_ROUTE,
  call→DISPATCHED, `dispatchedAt` captured), timeline notes, close call (`clearedAt`).
- Units: go on/off duty, status changes.
- Persons/vehicles/warrants/records/BOLOs: create + list + basic detail.
- Command Center: composes CAD counts + live ER:LC via the shared integration.
- Configuration: v1/v2 flag, enabled sections, default landing, call-number prefix.
- Permissions: **every CAD route enforces a granular `cad.*` action server-side** via the
  shared engine (`buildActorForUser` + `authorize`). Verified: 401 unauth, 404 cross-tenant
  read, no-op cross-tenant write.
- Audit: call create/close + warrant create write audit events.

## Key weaknesses (summary; details in the matrix & reviews)

1. **Not real-time** — dispatch/command-center use `setInterval` polling (8s), not
   subscriptions. No event ordering/dedup/conflict handling.
2. **Records have no lifecycle** — `CadRecord` has no status; the `REPORT_STATES` domain
   machine is unwired. No draft/review/approve/lock/revision/PDF.
3. **Warrants have no approval workflow** — created straight to `ACTIVE`; the
   `WARRANT_STATES` machine is unwired. No types/service/recall/auto-expiry.
4. **BOLOs are minimal** — no priority/expiry/match-alerts/subtypes.
5. **No evidence, court, fire/EMS, civilian portal** — absent (only unit-type enums).
6. **Units not linked to Ordinex identities** — `membershipId`/`agencyId` columns exist but
   unused; no partners, shifts, sessions, certifications, callsign uniqueness.
7. **Penal code hard-coded** — not tenant-configurable.
8. **Tenant configuration minimal** — only `CadSettings`; statuses/priorities/call types/
   dispositions/record types/number formats/approval chains are hard-coded.
9. **Permission scopes incomplete** — org+role enforced, but department/agency/authored/
   rank/record-type scopes are not.
10. **Audit coverage partial** — status changes, assignments, person/vehicle updates, BOLOs,
    record/warrant lifecycle, config changes, ER:LC imports, remote commands not audited.
11. **Security hardening items** — cross-tenant writes return 200 no-op (should 404); the
    ER:LC remote-command route enforces membership only (not `erlc:command`); webhooks are
    replay-able; baseline `member` role grants CAD read.
12. **No search infrastructure** — `contains`/`ILIKE` scans, `take:100` caps; will not scale.
13. **Mobile/PWA** — responsive grid only; not an offline-capable MDT.
