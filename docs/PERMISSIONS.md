# Permissions

Authorization lives in `@commandry/permissions`. Domain services call `authorize()`; UI never trusts client-side checks alone.

## `authorize()` API

```ts
import { authorize, explainAccess } from "@commandry/permissions";

const decision = authorize({
  actor,
  organizationId,
  action: "member:invite",
  resource?: {
    type: "invitation",
    organizationId,
    // optional: departmentId, ownerUserId, ownerMembershipId, sensitivity, …
  },
  context?: {
    requireBreakGlass?: boolean,
    now?: Date,
  },
});

// decision: { allowed, reason, matchedGrants, matchedRestrictions }
```

`explainAccess(actor, action)` wraps `authorize` for the permission simulator UI.

### Decision order (simplified)

1. Actor org must match requested `organizationId`.
2. Platform admin shortcut for `platform:*` actions when `actor.isPlatformAdmin`.
3. Optional break-glass requirement.
4. Resource org must match actor (else `cross_tenant`).
5. Restricted sensitivity requires elevated permission, owner/admin role, or active break-glass.
6. Collect permissions from system roles + explicit `permissionKeys`.
7. Allow if action is in the set.
8. Else allow ownership-scoped read / `*:manage_own` when resource owner matches.
9. Else allow if break-glass is active and actor has `permission:break_glass`.
10. Else deny (`missing_permission`).

## Scopes

`PermissionScope` types (for grants and future UI):

| Scope | Meaning |
| --- | --- |
| `organization` | Entire tenant |
| `department` | Single department id |
| `assigned_departments` | Actor's department memberships |
| `own` | Records the actor owns |
| `below_rank` | Targets below actor rank order |
| `session` | Specific session |
| `cad_agency` | CAD agency boundary |
| `public` | Non-sensitive public reads |

Runtime enforcement today focuses on **organization match**, **role/grant actions**, **ownership**, **sensitivity**, and **break-glass**. Finer department/rank scopes are modeled and partially stubbed for later releases.

## Actions

Canonical list: `ACTIONS` in `packages/permissions/src/actions.ts`. Families include:

- `organization:*` — read/update/delete, billing, modules, audit, export, integrations
- `member:*` — read/invite/update/remove/view_sensitive
- `role:*` / `permission:*` — manage roles, simulate, grant, break_glass
- `staff:*`, `department:*`, `shift:*`, `activity:*`, `session:*`
- `moderation:*`, `application:*`, `training:*`, `document:*`
- `cad:*`, `erlc:*`
- `platform:admin`, `platform:support_access`

Many actions are defined ahead of their domain modules so R2+ can ship without rewriting the permission vocabulary.

## System roles

Seeded/created on organization create (`owner`, `admin`, `moderator`, `staff`, `member`):

| Role | Intent |
| --- | --- |
| `owner` | Full control including delete, billing, break-glass |
| `admin` | Broad admin without ownership transfer / delete / billing |
| `moderator` | Moderation + live view + documents read |
| `staff` | Operational read + own shifts |
| `member` | Baseline org/member/document read |

Exact action sets: `SYSTEM_ROLE_PERMISSIONS` in `packages/permissions/src/types.ts`.

Per-membership `PermissionGrant` / `PermissionDenial` rows and role `permissions` string arrays feed `actor.permissionKeys`.

## Building an actor

`buildActorForUser(userId, organizationId)` in `@commandry/api`:

- Requires `ACTIVE` membership
- Loads roles, grants, departments, rank, active break-glass session
- Sets `isPlatformAdmin` when `platformRole` ∈ `ADMIN` | `SUPERADMIN` | `SUPPORT`

## Permission simulator

Route: `/app/settings/permissions` (authenticated).

- Loads the active organization actor
- Runs `explainAccess` for a sample of high-signal actions
- Shows allowed/denied with grant/restriction reasons
- **Does not** grant access by itself — server-side `authorize()` remains authoritative

## Platform roles

`User.platformRole`: `NONE` | `SUPPORT` | `ADMIN` | `SUPERADMIN`.

Support impersonation sessions are schema-ready (`SupportAccessSession`) but not exposed as a product workflow in R0/R1.
