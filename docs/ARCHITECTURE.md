# Architecture

## Style: modular monolith

Ordinex is a **modular monolith**. One deployable web app owns HTTP, one worker process owns background jobs, and domain logic lives in workspace packages with clear boundaries. Packages may become extractable services later; they are not separate networked services today.

Why this shape for R0/R1:

- Single Postgres database with tenant columns and indexes
- Shared authorization and audit libraries on every write path
- Fast iteration without distributed-system overhead
- Turborepo caching for lint/test/build across packages

## Runtime apps

| App                | Role                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `apps/web`         | Next.js 16 App Router — marketing, auth UI, app shell, REST route handlers                                   |
| `apps/worker`      | BullMQ consumers on Redis; system queue (`health.check`, `demo.echo`); records `JobFailure` rows             |
| `apps/discord-bot` | Scaffold; idle diagnostic mode without `DISCORD_BOT_TOKEN`; full slash-command runtime planned for Release 5 |

## Packages

### Core (implemented)

| Package                    | Responsibility                                                                  |
| -------------------------- | ------------------------------------------------------------------------------- |
| `@commandry/database`      | Prisma 7 client via `@prisma/adapter-pg`, schema, AES-256-GCM credential crypto |
| `@commandry/auth`          | Better Auth factory (magic link + optional Discord), Next.js handler wiring     |
| `@commandry/api`           | Organization lifecycle, invitations, actor building                             |
| `@commandry/permissions`   | Actions, system role maps, `authorize()` / `explainAccess()`                    |
| `@commandry/audit`         | `recordAuditEvent` + metadata sanitization                                      |
| `@commandry/validation`    | Zod org/env schemas                                                             |
| `@commandry/observability` | JSON logger with redaction, request IDs                                         |
| `@commandry/shared`        | Public IDs, `AppError` hierarchy, module keys                                   |
| `@commandry/ui`            | Button, Input, Badge, EmptyState, tokens (teal, Sora/Fraunces)                  |

### Integration / foresight (interfaces & constants)

| Package                    | Current state                                         |
| -------------------------- | ----------------------------------------------------- |
| `@commandry/erlc`          | `ErlcClient` type + simulator (`ERLC_MODE=simulator`) |
| `@commandry/discord`       | OAuth/bot credential status helper                    |
| `@commandry/ai`            | `DEFAULT_AI_SAFETY_POLICY` constants                  |
| `@commandry/billing`       | `PLAN_LIMITS` constants only                          |
| `@commandry/roblox`        | Stable Roblox user ID assertion                       |
| `@commandry/notifications` | Channel types + `shouldDeliver` stub                  |
| `@commandry/integrations`  | Provider/health types                                 |
| `@commandry/analytics`     | Safe property assertion                               |
| `@commandry/config`        | App name / default timezone                           |
| `@commandry/testing`       | Test request ID helper                                |

## Request flow

```text
Browser
  → Next.js App Router (RSC pages / client components)
  → Route handlers under apps/web/src/app/api/*
       → session via Better Auth (cookies)
       → Zod validation (@commandry/validation)
       → domain service (@commandry/api)
            → authorize() (@commandry/permissions)
            → Prisma (@commandry/database)
            → recordAuditEvent (@commandry/audit)
       → JSON response / AppError mapping
```

Background path:

```text
Producer (future web/API or worker bootstrap)
  → BullMQ queue on Redis
  → apps/worker Worker
       → job handler
       → on failure → job_failures table
```

## Multi-tenant model

- **Tenant = Organization**. Memberships bind users to orgs with status (`ACTIVE`, `INVITED`, …).
- Users may belong to many orgs; `User.activeOrganizationId` (and session field) tracks the current workspace.
- Actors for authorization are built from the active membership: role keys, grants, departments, rank, break-glass window, platform role.
- Resources passed to `authorize()` must carry `organizationId`; mismatch → `cross_tenant` deny.
- Soft delete: `Organization.deletedAt` / status enums; memberships with deleted orgs are excluded from listings.
- External secrets (ER:LC keys, Discord tokens) store as ciphertext/iv/authTag on `IntegrationCredential`, never plaintext.

Public IDs (`org_…`, `usr_…`, `mem_…`) are exposed over APIs; internal cuid primary keys stay server-side where practical.

## Workers & queues

Declared queue names (`apps/worker/src/queues.ts`):

| Queue                             | Purpose (now / planned)                  |
| --------------------------------- | ---------------------------------------- |
| `commandry.system`                | Implemented: `health.check`, `demo.echo` |
| `commandry.moderation.expiration` | Planned                                  |
| `commandry.notifications`         | Planned                                  |
| `commandry.integrations`          | Planned                                  |

BullMQ is the job source of truth; `JobFailure` aids ops visibility.

## Module surface

`MODULES` in `@commandry/shared` lists product domains. The web app shell navigates to `/app/[module]` placeholders that render **Foundation only** empty states. Enabled modules are stored on `Organization.enabledModules` (defaults include home, people, staff, departments, sessions, activity, settings).

## Design system notes

CSS variables in `@commandry/ui` define an operational teal palette with Sora (sans) and Fraunces (display). Light and dark tokens exist; motion respects `prefers-reduced-motion`.
