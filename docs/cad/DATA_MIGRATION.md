# CAD/MDT — Data Migration & Preservation

## Principles

- **Versioned** Prisma migrations only (no ad-hoc SQL against production).
- **Additive-first:** M1 adds tables/columns and never drops or rewrites existing
  CAD data. Destructive changes (e.g. `CadCivilian` → `CadCharacter` rename) are
  deferred to a later, separately-gated migration with a copy + backfill + verify
  step, never an in-place destructive rename.
- **Preserve** creation dates, authorship, status, and history; keep old public
  ids stable so existing links keep resolving.
- **No silent drops:** unsupported/legacy fields are retained (kept columns or
  moved to a `legacy` JSON blob) rather than discarded.
- **Reversible:** every migration has a documented rollback (see `ROLLBACK_PLAN.md`).

## M1 migration (additive, non-destructive)

Adds:

- `CadAgency` — org-scoped agency that may reference an Ordinex `Department`
  (`departmentId?`). Units and calls gain an optional `agencyId`.
- `CadSettings` — per-org CAD feature flag + configuration (enabled, version,
  default landing, enabled sections, call-number format).
- `CadUnit` new optional columns: `agencyId`, `memberId` (Ordinex membership),
  `division`, `locationText`. Existing rows are untouched (all nullable).
- `CadCall` new optional columns: `callNumber` (int sequence, nullable),
  `dispatchedAt`, `enRouteAt`, `onSceneAt`, `clearedAt`, `disposition`. Existing
  rows keep their data; new columns are null until set by the v2 flow.

No columns are dropped and no enums lose values in M1.

## Legacy → new mapping (full rewrite, tracked across milestones)

| Legacy entity           | New entity              | Strategy                                                                           |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| `CadUnit`               | `CadUnit` (extended)    | In place; backfill `agencyId` to a default agency                                  |
| `CadCall` (+units/logs) | `CadCall` (extended)    | In place; backfill `callNumber` from `openedAt` order                              |
| `CadCivilian`           | `CadCharacter`          | Copy + backfill in a later gated migration; keep legacy id in a mapping table      |
| `CadVehicle`            | `CadVehicle` (extended) | In place; add VIN/year/class (nullable)                                            |
| `CadWarrant`            | `CadWarrant` (workflow) | In place; existing `ACTIVE` rows map to workflow state `ACTIVE`                    |
| `CadRecord`             | `CadRecord` (workflow)  | In place; existing rows default to `APPROVED`+`LOCKED` (they were already "filed") |
| `CadBolo`               | `CadBolo` (extended)    | In place; add priority/subtype (defaults)                                          |

Mapping tables (added when the destructive copy migrations land):
`cad_legacy_id_map(entity, legacy_public_id, new_public_id)`.

## Dry-run, validation, reporting

A migration verifier (`packages/cad` script, added with the destructive
milestones) will:

1. Snapshot per-entity counts before migration.
2. Run the migration inside a transaction (dry-run mode rolls back).
3. Re-count and reconcile; fail if counts diverge unexpectedly.
4. Log rejected/malformed rows to a report file.
5. Be idempotent where practical (upserts keyed by legacy id).

## Current data note

On this branch, CAD data is development/placeholder only (verified in the audit),
so M1's additive migration carries zero risk to real tenants. The same procedure
is designed to be safe for production tenants when they exist.
