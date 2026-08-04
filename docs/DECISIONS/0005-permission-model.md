# 0005. Permission model

Date: 2026-08-02  
Status: Accepted

## Context

ER:LC communities need fine-grained, explainable access control across many modules, with hard multi-tenant isolation. Ad-hoc role checks in route handlers would diverge quickly and hide privilege bugs.

## Decision

Centralize authorization in `@commandry/permissions`:

- Canonical `ACTIONS` string vocabulary (`resource:verb`)
- System role → action maps for `owner` / `admin` / `moderator` / `staff` / `member`
- Pure function `authorize({ actor, organizationId, action, resource?, context? })` returning allow/deny with grants and restrictions
- `explainAccess` for the in-app permission simulator
- Actors built server-side from memberships, grants, departments, rank, break-glass, and platform role
- Cross-tenant resource mismatch is always deny

Domain services (`@commandry/api`) call `authorize()` before mutating; UI simulation is non-authoritative.

## Consequences

**Positive**

- One decision path to test (unit tests cover cross-tenant and role cases)
- Actions can be reserved before modules ship without inventing fake UI powers
- Simulator builds operator trust and aids support

**Trade-offs**

- Scope types (department, below_rank, cad_agency) are modeled ahead of full enforcement
- Role permission arrays + grants must stay consistent when custom roles land
- Platform support impersonation must still compose with this model when productized
