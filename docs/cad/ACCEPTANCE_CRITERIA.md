# CAD/MDT — Acceptance Criteria

## Definition of complete (whole rewrite)

- [ ] Old CAD feature matrix accounted for and mapped (`REWRITE_PLAN.md`).
- [ ] Required legacy data migrated and reconciled.
- [ ] All new CAD workflows persist data; no placeholder actions remain.
- [ ] Real-time updates work (calls, unit status, alerts).
- [ ] Permissions enforced **server-side** on every CAD action.
- [ ] Tenant isolation tests pass (Org A cannot read Org B CAD data).
- [ ] ER:LC integration uses the shared integration layer only.
- [ ] CAD matches the Ordinex design system.
- [ ] Mobile MDT workflows and accessibility pass.
- [ ] Security + performance reviews pass.
- [ ] Full Ordinex regression suite green; unrelated modules unaffected.
- [ ] Rollback procedures tested; legacy CAD retirable.

## Milestone 1 acceptance (this PR)

- [x] Mandatory audit + six planning docs produced.
- [x] Baseline test results recorded (35/35 Turbo tasks).
- [x] Granular `cad.*` permissions added (additive) and **enforced server-side** in
      every CAD route via the shared engine (`buildActorForUser` + `authorize`);
      unauthorized callers receive `ForbiddenError` (403). Role denial unit-tested.
- [x] CAD domain core (unit-status + call-status state machines, call numbering,
      response-time metrics, record/warrant workflow states, expiration) implemented
      as pure functions with passing unit tests (9 domain tests).
- [x] Additive, non-destructive migration adds `CadAgency`, `CadSettings`, and
      optional unit/call columns; verified no DROP/DELETE — existing data preserved.
- [x] Per-tenant CAD settings + feature flag (`v1`/`v2`, enabled, sections,
      default landing, call-number prefix) exist and gate the module.
- [x] CAD Command Center renders real org data (+ live ER:LC via the shared
      integration) inside a CAD secondary navigation, without replacing the main
      Ordinex dashboard or global navigation.
- [x] Consequential CAD actions (call create/close, warrant create) write to the
      shared audit log.
- [x] Existing CAD dispatch/records workflows still function (no regression).
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` all green (35/35 tasks).

## Cross-cutting invariants (every milestone)

- Server-side authorization on all mutations.
- Org scoping on every query and mutation.
- Approved/locked records and evidence chain-of-custody are append-only.
- AI never approves/issues/executes; output is labeled and reviewable.
- No credentials exposed to the browser.
- No business logic in React components.
