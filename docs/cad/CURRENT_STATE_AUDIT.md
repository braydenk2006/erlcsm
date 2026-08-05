# CAD/MDT — Current State Audit

Audit date: 2026-08-05. Branch: `cursor/ordinex-rebrand-live-erlc-6056`.
Scope: the CAD/MDT module only. This document is the mandatory pre-rewrite audit.

## 1. Baseline test results

`pnpm lint`, `pnpm typecheck`, `pnpm test` → **35 / 35 Turbo tasks successful** (all
package suites green). This is the regression baseline; the rewrite must keep it green.

## 2. Feature inventory (what exists today)

| Area            | Implemented                                                                                                               | Notes / gaps                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Dispatch        | Units on/off duty, unit status (6), create call, assign/unassign unit, call timeline notes, close call, ER:LC call sync   | Polling (8s), not real-time; no merge/split/transfer/mutual-aid; no map; no priority queue board                |
| Units           | callsign, name, type, status, optional robloxUsername                                                                     | **Not linked to Ordinex member/staff/shift/session**; no agency/division/rank; no location                      |
| Calls           | title, type, caller, message, location, postal, priority, status (PENDING/DISPATCHED/ACTIVE/CLOSED), assigned units, logs | No configurable call number, no response-time metrics, no dispositions, no linked/related calls, no coordinates |
| Persons         | `CadCivilian` (name, DOB, license, flags, notes, robloxUsername)                                                          | **No real-user vs character distinction**; no sensitive-field permissioning; no aliases/employment/medical      |
| Vehicles        | plate, model, color, owner, registration, insurance, stolen                                                               | No VIN/year/class/impound/tow/BOLO-link                                                                         |
| Records         | `CadRecord` (citation/arrest/incident/warning) with charges, fine, narrative                                              | **No record status/workflow** (draft→review→approve→lock); no revision history, no PDF/print                    |
| Warrants        | reason, charges, ACTIVE/CLEARED/EXPIRED                                                                                   | **No approval workflow** (issued straight to ACTIVE); no types/scope/service details                            |
| BOLOs           | person/vehicle, title, description, plate, ACTIVE/CLEARED                                                                 | No match alerts; no priority; no plate/property/weapon/location subtypes                                        |
| Evidence        | —                                                                                                                         | Absent                                                                                                          |
| Court           | —                                                                                                                         | Absent                                                                                                          |
| Fire/EMS        | —                                                                                                                         | Absent (only unit types FIRE/EMS exist)                                                                         |
| Civilian portal | —                                                                                                                         | Absent                                                                                                          |
| Command Center  | —                                                                                                                         | Absent (only a 6-number summary strip)                                                                          |
| Penal code      | `PENAL_CODE` constant (25 charges)                                                                                        | Not org-configurable                                                                                            |
| AI tools        | —                                                                                                                         | Absent                                                                                                          |
| Analytics       | —                                                                                                                         | Absent (summary counts only)                                                                                    |

## 3. Route inventory

CAD API (`apps/web/src/app/api/cad/**`, 15 route files):
`summary`, `penal-code`, `units`, `units/[id]`, `calls`, `calls/[id]`,
`civilians`, `civilians/[id]`, `vehicles`, `vehicles/[id]`, `warrants`,
`warrants/[id]`, `records`, `bolos`, `bolos/[id]`.

CAD-adjacent (owned by ER:LC integration, consumed by CAD):
`api/erlc/sync` (on-demand call/CAD sync + player history), `api/erlc/history`.

UI: `app/app/cad/page.tsx` → `components/cad/cad-workspace.tsx` with views
`dispatch-view`, `civilians-view`, `vehicles-view`, `warrants-view`,
`bolos-view`, `personnel-view` (+ `types.ts`). `components/cad/cad-sync-button.tsx`
is now **dead code** (unused after the workspace rewrite).

## 4. Database inventory

Migration `20260805005331_cad_mdt_system`. Models (all org-scoped, `@map` snake_case, `publicId`):

`CadCall` (+ `CadCallUnit`, `CadCallLog`), `CadUnit`, `CadCivilian`,
`CadVehicle`, `CadWarrant`, `CadRecord`, `CadBolo`.

Enums: `CadCallStatus` (PENDING/DISPATCHED/ACTIVE/CLOSED), `CadUnitType`
(POLICE/SHERIFF/STATE/FIRE/EMS/DISPATCH), `CadUnitStatus` (6), `CadLicenseStatus`,
`CadRegistrationStatus`, `CadWarrantStatus`, `CadRecordType`, `CadBoloType`,
`CadBoloStatus`.

Relations on `Organization`: `cadCalls`, `cadUnits`, `cadCivilians`,
`cadVehicles`, `cadWarrants`, `cadRecords`, `cadBolos`.

## 5. Permission inventory

Global actions (`packages/permissions/src/actions.ts`): `cad:dispatch`,
`cad:unit`, `cad:records`, `cad:manage`. Owner + admin roles include all four.

**Critical finding:** CAD API routes only call `requireActiveOrganization()` (session

- membership). They do **not** call the `authorize()` engine, so any authenticated
  org member can dispatch, close calls, issue warrants, etc. This is the top security
  gap to fix in the rewrite (server-side, per-action authorization).

## 6. Jobs / events / integration inventory

- Worker: `erlc.maintenance` (health + player-history correlation, 60s). CAD call
  sync is **on-demand** only. No CAD-specific jobs, no real-time event bus.
- Shared services **used** by CAD: `@commandry/database` (prisma + crypto),
  `@commandry/shared` (ids/errors), `@commandry/integrations` + `@commandry/erlc`
  (live server, call sync, player history).
- Shared services **not** used (should be): `@commandry/audit` (no CAD auditing),
  notifications, analytics, AI, and the `authorize()` permission engine.

## 7. Data-preservation assessment

Current CAD rows are **development/placeholder** data created during feature
demos (e.g. civilian "John Citizen", unit "1A-12"). No production tenant data
exists yet on this branch. The rewrite will still ship a **data-preserving,
versioned, additive** migration (see `DATA_MIGRATION.md`) so the same procedure
works for real tenants, and will validate counts before/after with a dry-run.

## 8. Non-CAD dependencies (must not break)

CAD imports only `@commandry/{database,shared,integrations,erlc}` and shared UI
(`@commandry/ui`) + `@/lib/{organization,session,api}`. No non-CAD module imports
CAD tables or the `@commandry/cad` package, so the blast radius of the rewrite is
contained. The only shared change required for the rewrite is **additive**
permission actions (documented in `INTEGRATION_MAP.md`).
