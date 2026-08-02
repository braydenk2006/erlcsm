# API

REST surface today is intentionally small. Handlers live under `apps/web/src/app/api`. Domain logic belongs in `@commandry/api`.

All JSON errors from domain code use `AppError` codes when mapped (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, …).

## Health

### `GET /api/health`

Liveness-oriented probe that also pings the database.

**200**

```json
{ "status": "ok", "service": "web", "time": "2026-08-02T03:00:00.000Z" }
```

**503** when Postgres is unreachable:

```json
{ "status": "degraded", "service": "web", "database": "unavailable" }
```

### `GET /api/ready`

Readiness probe (DB required).

**200** `{ "ready": true }`  
**503** `{ "ready": false }`

## Auth (Better Auth)

### `GET|POST /api/auth/[...all]`

Better Auth catch-all via `toNextJsHandler(auth)`.

Configured behaviors:

| Method         | Notes                                                                                   |
| -------------- | --------------------------------------------------------------------------------------- |
| Magic link     | Always registered; logs URL to console in development; Resend wiring is milestone-later |
| Discord OAuth  | Registered only when `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are set            |
| Email/password | Disabled                                                                                |

Client helper: `@commandry/auth` → `authClient` with `magicLinkClient()`. Session helpers in the web app: `getSession()` / `requireSession()`.

Exact Better Auth paths follow the library conventions under `/api/auth/*` (session, magic-link send/verify, OAuth callbacks). Do not invent custom auth routes beyond this mount.

## Organizations

### `GET /api/organizations`

Requires session.

Returns organizations for the signed-in user’s **active** memberships:

```json
{
  "organizations": [
    {
      "id": "org_…",
      "name": "Example Community",
      "slug": "example-community",
      "roles": ["owner"]
    }
  ]
}
```

`id` is the organization **publicId**.

### `POST /api/organizations`

Requires session. Body validated by `createOrganizationSchema`:

| Field              | Rules                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `name`             | 2–80 chars                                                                                                 |
| `slug`             | lowercase alphanumeric + hyphens, 3–48                                                                     |
| `timezone`         | optional, default `UTC`                                                                                    |
| `organizationType` | `private_server` \| `roleplay` \| `department_heavy` \| `law_enforcement` \| `border_roleplay` \| `custom` |
| `approximateSize`  | `small` \| `medium` \| `large` \| `enterprise`                                                             |

**201**

```json
{ "id": "org_…", "name": "…", "slug": "…" }
```

Side effects: creates system roles, owner membership, sets `activeOrganizationId`, writes `organization.created` audit event. Slug conflicts → `409 CONFLICT`.

### `POST /api/organizations/switch`

Requires session. Body: `{ "organizationId": "<internal or resolvable id>" }` via `switchOrganizationSchema`.

Requires an **ACTIVE** membership. Updates `User.activeOrganizationId`, audits `organization.switched`.

**200** `{ "id": "org_…", "name": "…", "slug": "…" }`

## Service-layer APIs (not yet HTTP-exposed)

Implemented in `@commandry/api` for upcoming routes/UI wiring:

- `updateOrganization`
- `getOrganizationForActor`
- `inviteMember` / `acceptInvitation`
- `buildActorForUser`
- `listMembershipsForUser`

Invitation tokens are returned only at creation time; only SHA-256 hashes are persisted.

## Not available yet

No public REST for people, staff, moderation, CAD, ER:LC commands, billing webhooks, or Discord interactions. Those land with their release milestones.
