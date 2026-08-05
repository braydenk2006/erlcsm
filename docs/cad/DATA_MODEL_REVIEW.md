# CAD/MDT — Data Model Review

Review of CAD Prisma models against tenancy, integrity, auditability, versioning,
concurrency, and scale requirements.

## Tenancy & keys

| Concern                               | Status                                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Organization ownership on every model | ✅ all CAD models have `organizationId` + relation                                                                           |
| Foreign keys                          | ✅ present (units↔calls via join, owner→civilian, agency→department)                                                         |
| Cascade on org delete                 | ✅ `onDelete: Cascade` from Organization                                                                                     |
| SetNull for soft links                | ✅ vehicle.owner, unit.agency, record.civilian                                                                               |
| Composite tenant indexes              | ⚠️ partial: `@@index([organizationId, status/lastName/plate])`; missing `org+createdAt`/`org+openedAt` for keyset pagination |
| Cross-tenant access blocked           | ✅ verified (reads 404, writes no-op) — all queries filter `organizationId`                                                  |

## Unique constraints / dedup

| Concern                          | Status                                              |
| -------------------------------- | --------------------------------------------------- |
| Call dedup key                   | ✅ `@@unique([organizationId, source, externalId])` |
| ER:LC source identifiers         | ✅ `source` + `externalId` on `CadCall`             |
| Idempotent call sync             | ✅ upsert by dedup key                              |
| Vehicle plate uniqueness per org | ❌ none (duplicate plates allowed)                  |
| Unit callsign uniqueness per org | ❌ none (duplicate callsigns allowed)               |
| Warrant/BOLO natural keys        | ❌ none                                             |

## Auditability, versioning, history

| Concern                              | Status                                                 |
| ------------------------------------ | ------------------------------------------------------ |
| Record versioning                    | ❌ no version columns anywhere                         |
| Status histories (unit/call/warrant) | ❌ none (only latest status + a call note log)         |
| Immutable approved records           | ❌ no lock/approval state                              |
| Evidence chain of custody            | ❌ no evidence model                                   |
| Append-only audit                    | ✅ `audit_events` has no update path; partial coverage |

## Concurrency & idempotency

| Concern                                | Status                                                   |
| -------------------------------------- | -------------------------------------------------------- |
| Atomic call-number allocation          | ✅ `cadSettings.callSequence { increment }` in an upsert |
| Unit assignment idempotency            | ✅ `cadCallUnit.upsert` on `(callId,unitId)`             |
| Optimistic locking / version guards    | ❌ none — concurrent edits are last-write-wins           |
| First-dispatch timestamp guard         | ✅ `updateMany where dispatchedAt: null`                 |
| Duplicate unit-on-two-calls prevention | ❌ not enforced                                          |

## Expiration & jobs

| Concern                              | Status     |
| ------------------------------------ | ---------- |
| Warrant/BOLO `expiresAt`             | ❌ missing |
| Expiration worker                    | ❌ none    |
| Reconciliation after worker downtime | ❌ none    |

## Search & scale

| Concern                    | Status                           |
| -------------------------- | -------------------------------- |
| Full-text / trigram search | ❌ uses `contains`/`ILIKE` scans |
| Pagination                 | ⚠️ fixed `take: 100`, no cursor  |
| Retention / archival       | ❌ none                          |

## Recommended model changes (for M2)

- Add `expiresAt` to `CadWarrant`/`CadBolo`; add `status` + `revision` + `lockedAt` to
  `CadRecord`; add `CadWarrant.type`/workflow `state`.
- Add history tables: `CadUnitStatusEvent`, `CadCallStatusEvent`, `CadWarrantEvent`.
- Add `CadEvidence` (+ append-only `CadEvidenceCustody`).
- Add unique constraints: `@@unique([organizationId, plate])` (vehicles),
  `@@unique([organizationId, callsign])` (active units).
- Add `@updatedAt`-based or explicit `version Int` optimistic-lock columns on mutable records.
- Add `org+createdAt`/`org+openedAt` indexes; adopt cursor pagination; add trigram indexes
  (`pg_trgm`) or a search table for person/vehicle lookup at 50k–100k rows.
- Introduce tenant-config tables: `CadStatusCode`, `CadCallType`, `CadDisposition`,
  `CadPenalCharge`, `CadRecordType`, `CadNumberFormat` (replacing hard-coded constants).
