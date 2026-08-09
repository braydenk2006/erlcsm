# CAD/MDT — Rollback Plan

## Feature-flag rollback (primary, instant)

CAD v2 is gated by `CadSettings.version` / `enabled` per organization. Rolling
back is a data flip, not a deploy:

- Set `CadSettings.version = "v1"` (or `enabled = false`) for an org to restore the
  previous behavior/landing without touching code or schema.
- Because M1 is additive (no dropped tables/columns), the legacy code paths and
  data remain fully intact behind the flag.

## Code rollback

- The rewrite lands in reviewable milestones on a feature branch. Reverting a
  milestone's commits restores the prior state; the additive migrations can remain
  applied (unused columns/tables are harmless) or be reversed (below).

## Migration rollback

- M1 migration is additive. To reverse: a down-migration drops `CadAgency`,
  `CadSettings`, and the added optional columns. Since these columns are nullable
  and unused by legacy code, dropping them does not affect legacy CAD data.
- Destructive later migrations (e.g. `CadCivilian` → `CadCharacter`) use
  **copy + backfill** (never in-place). Rollback = keep the legacy table (still
  populated) and point the flag back to v1; the new table can be dropped.
- A pre-migration backup (`pg_dump` of `cad_*` tables) is taken before any
  destructive step; restore path is documented with the migration.

## Verification after rollback

1. `pnpm test` green.
2. Legacy CAD routes/UI reachable and functional.
3. Row counts for `cad_*` tables match the pre-change snapshot.
4. No unrelated module affected (smoke test auth, org switch, dashboard).

## Data safety guarantees

- No production data is deleted during initial (additive) migration.
- Legacy data is retained until a milestone is validated and explicitly retired.
- Two independently-editable CAD systems are never left active long-term: v2 is
  gated on per-org, and v1 is retired only after reconciliation.
