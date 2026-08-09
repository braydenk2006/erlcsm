# CAD / MDT

Package: `@commandry/cad` (domain service + penal code). UI at `/app/cad`.

A full Computer-Aided Dispatch and Mobile Data Terminal / Records Management
system for ER:LC roleplay servers. Everything is organization-scoped and
integrates with the live server: 911 calls sync in from ER:LC, and online
players are correlated into player history.

## Modules

| Area                | Capabilities                                                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dispatch**        | Units go on/off duty with status (Available, En route, On scene, Panic, …). Create calls or sync 911 calls from ER:LC, assign/unassign units, add timeline notes, set status, and close calls. Assigning a unit flips the call to DISPATCHED and the unit to EN_ROUTE. |
| **Civilians (RMS)** | Create/search person records, set license status (Valid/Suspended/Revoked/Expired), flags, and notes. Each record aggregates the civilian's vehicles, warrants, and records.                                                                                           |
| **Vehicles**        | Register vehicles (plate, model, color, owner), search by plate/model, and flag/recover stolen.                                                                                                                                                                        |
| **Warrants**        | Issue warrants against a civilian with penal-code charges; view and clear active warrants department-wide.                                                                                                                                                             |
| **Records**         | File citations, arrests, incident reports, and written warnings with charges, fine amounts, and a narrative.                                                                                                                                                           |
| **BOLOs**           | Issue and clear person/vehicle Be-On-the-Lookout alerts.                                                                                                                                                                                                               |
| **Personnel**       | ER:LC player-history correlation (presence rolled up and linked to Roblox identities).                                                                                                                                                                                 |

## Data model

`CadUnit`, `CadCall` (+ `CadCallUnit`, `CadCallLog`), `CadCivilian`,
`CadVehicle`, `CadWarrant`, `CadRecord`, `CadBolo` — all in
`packages/database/prisma/schema.prisma`, org-scoped with `@map` snake_case
columns and public ids.

## Penal code

`PENAL_CODE` in `@commandry/cad` ships a default set of charges (traffic,
misdemeanor, felony, infraction) with fines and jail times, exposed at
`GET /api/cad/penal-code` and used by the charge pickers.

## API

`/api/cad/summary`, `/api/cad/units`, `/api/cad/units/[id]`, `/api/cad/calls`,
`/api/cad/calls/[id]` (assign/unassign/log/status/close), `/api/cad/civilians`,
`/api/cad/civilians/[id]`, `/api/cad/vehicles`, `/api/cad/vehicles/[id]`,
`/api/cad/warrants`, `/api/cad/warrants/[id]`, `/api/cad/records`,
`/api/cad/bolos`, `/api/cad/bolos/[id]`, `/api/cad/penal-code`.

## ER:LC integration

- **Calls:** dispatchers pull ER:LC 911 calls into CAD on demand via
  `POST /api/erlc/sync` (the "Sync ER:LC" button). This is intentionally not a
  background job so calls are not imported unbounded.
- **Player history:** the worker's `erlc.maintenance` job continuously
  correlates online players (deduped by Roblox user id) and monitors
  integration health.

## Permissions

Gated by the existing `cad:dispatch`, `cad:unit`, `cad:records`, and
`cad:manage` actions (owner/admin roles include all four).
