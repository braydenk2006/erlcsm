# CAD/MDT — Rewrite Plan

A controlled, milestone-based rewrite of the CAD/MDT module that keeps the rest
of Ordinex operational. The `@commandry/cad` package + `apps/web/.../cad` UI are
the module boundary (the repo's equivalent of the requested `modules/cad/`).

## Architecture

Clean layering inside `@commandry/cad`:

```
packages/cad/src/
  domain/         Pure logic: state machines, numbering, metrics, workflows (no I/O)
  application/    Org-scoped services orchestrating domain + prisma + shared services
  index.ts        Public interface (services + domain helpers + penal code)
apps/web/src/
  app/app/cad/    Route + secondary navigation shell + section pages
  components/cad/  Presentational + interactive components (no business logic)
  app/api/cad/     Thin controllers: authz → service → response
```

Principles: business logic lives in `domain`/`application`, never in React
components; no non-CAD module queries CAD tables; CAD consumes shared Ordinex
data (users, orgs, staff, departments, ER:LC) rather than duplicating it.

## Current feature → replacement map

| Current                       | Replacement                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Coarse `cad:*` (unenforced)   | Granular `cad.*` actions, enforced server-side in every route                                                |
| `CadUnit` (standalone)        | Unit references Ordinex member/staff + `CadAgency` (which references a Department); richer status + location |
| `CadCall` (basic)             | Configurable call number, response-time metrics, dispositions, richer timeline                               |
| `CadCivilian` (conflated)     | `CadCharacter` (fictional) with clear separation from real Ordinex users; sensitive fields permissioned      |
| `CadRecord` (no workflow)     | Records with draft→submitted→review→approved/rejected→locked lifecycle + revision history                    |
| `CadWarrant` (instant ACTIVE) | Warrant approval workflow (draft→submitted→review→approved→active→served/expired/recalled)                   |
| `CadBolo` (basic)             | BOLOs with priority + subtypes + match alerts                                                                |
| Summary strip                 | CAD Command Center                                                                                           |
| —                             | Evidence (append-only chain of custody), Court, Fire/EMS, Civilian portal                                    |
| Polling                       | Real-time event channels (tenant-isolated, permission-aware)                                                 |
| No audit                      | Shared audit service on consequential actions                                                                |

## Milestones

- **M1 — Foundation (this PR):** audit + docs; granular `cad.*` permissions (shared,
  additive) enforced in routes; CAD domain core (unit/call state machines, call
  numbering, response-time metrics, workflow states) with unit tests; additive
  data-preserving migration (`CadAgency`, `CadSettings`, unit/call extensions);
  per-tenant CAD settings + feature flag; CAD secondary navigation + Command
  Center; shared audit wired into consequential actions. Full regression green.
- **M2 — Dispatch & Units v2:** agencies, member-linked units, unit board, priority
  queue, dispositions, response-time reporting, richer timeline, map overlay.
- **M3 — Records & Persons v2:** character vs real-user model, record workflow +
  revision history + PDF, sensitive-field permissioning.
- **M4 — Warrants, BOLOs, Evidence:** approval workflows, BOLO match alerts,
  append-only evidence chain of custody.
- **M5 — Court, Fire/EMS, Civilian portal.**
- **M6 — Real-time, AI tools, analytics, performance hardening.**
- **M7 — Migration dry-run/reconcile, gradual rollout, legacy retirement.**

Each milestone ends with the progress report format in the task spec and a green
full-platform regression run.

## Non-goals for M1

Evidence/Court/Fire-EMS/Civilian portal, real-time transport, AI tools, and the
full persons/records workflow UIs are explicitly deferred to later milestones.
M1 establishes the foundation and a visible Command Center without destabilizing
the platform.
