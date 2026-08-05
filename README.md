# Ordinex

**Ordinex** is a multi-tenant SaaS operating system for Emergency Response: Liberty County (ER:LC) communities. It unifies staff, sessions, moderation, CAD, training, Discord, and live-server operations under tenant-isolated controls.

This repository is a greenfield **modular monolith** (pnpm workspaces + Turborepo). Release 0 and early Release 1 focus on foundations: identity, organizations, permissions, audit, schema, and developer tooling. Domain modules are scaffolded and labeled as foundation-only — they are not claimed as complete product features.

## Stack

| Layer      | Choice                                                                            |
| ---------- | --------------------------------------------------------------------------------- |
| Monorepo   | pnpm workspaces + Turborepo                                                       |
| Web        | Next.js 16 App Router, React 19                                                   |
| Data       | PostgreSQL, Prisma 7 (`@prisma/adapter-pg`)                                       |
| Jobs       | Redis + BullMQ                                                                    |
| Auth       | Better Auth (magic link; Discord OAuth when configured)                           |
| Validation | Zod                                                                               |
| UI         | Tailwind CSS 4, shared `@commandry/ui` tokens (teal/operational, Sora + Fraunces) |
| Tests / CI | Vitest, GitHub Actions                                                            |

## Quickstart

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 16 and Redis 7 (via Docker Compose below, or local installs)

### 1. Install

```bash
pnpm install
```

### 2. Environment

```bash
cp .env.example .env
```

Set at least:

- `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
- `CREDENTIALS_ENCRYPTION_KEY` — `openssl rand -base64 32`
- `DATABASE_URL`, `REDIS_URL`, `APP_URL`, `BETTER_AUTH_URL`

Discord, Resend, Stripe, S3, and AI keys are optional in development.

### 3. Infrastructure (optional Docker)

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

This starts Postgres, Redis, Mailpit, and MinIO. Docker is not required if you already run Postgres and Redis locally with matching connection strings.

### 4. Database

```bash
pnpm db:generate
pnpm db:migrate
# optional
pnpm db:seed
```

### 5. Develop

```bash
pnpm dev
```

- Web: [http://localhost:3000](http://localhost:3000)
- Worker and Discord bot start via Turborepo; the bot stays idle without `DISCORD_BOT_TOKEN`.

### 6. Test & quality

```bash
pnpm test
pnpm quality   # format, lint, typecheck, test, build
```

## Monorepo layout

```
apps/
  web/            Next.js app (UI + REST route handlers)
  worker/         BullMQ workers
  discord-bot/    Discord bot scaffold (idle without credentials)
packages/
  database/       Prisma schema, client, credential crypto
  auth/           Better Auth server/client
  api/            Domain services (organizations, invitations, …)
  ui/             Design system primitives + CSS tokens
  permissions/    authorize() + system roles + actions
  audit/          Append-only audit recording + redaction
  validation/     Zod schemas (orgs, env)
  observability/  Structured logging + request IDs
  shared/         Public IDs, errors, module keys
  erlc/           ER:LC client interface + simulator
  discord/        Discord setup status helpers
  ai/             AI safety policy constants
  billing/        Plan limit constants (no Stripe runtime yet)
  …               stubs: roblox, notifications, integrations, analytics, config, testing
infra/
  docker/         Local compose (Postgres, Redis, Mailpit, MinIO)
docs/             Product, architecture, ADRs, status
```

## Documentation

| Doc                                                            | Topic                                   |
| -------------------------------------------------------------- | --------------------------------------- |
| [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md)   | Vision, principles, release plan        |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                   | Modular monolith, request flow, tenancy |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)             | Entities, indexes, ER diagram           |
| [docs/PERMISSIONS.md](docs/PERMISSIONS.md)                     | Authorization model                     |
| [docs/API.md](docs/API.md)                                     | Current REST endpoints                  |
| [docs/SECURITY.md](docs/SECURITY.md)                           | Threat model                            |
| [docs/TESTING.md](docs/TESTING.md)                             | Vitest / Playwright strategy            |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                       | Env, Docker, staging/prod               |
| [docs/ERLC_INTEGRATION.md](docs/ERLC_INTEGRATION.md)           | ER:LC interface & simulator             |
| [docs/DISCORD_INTEGRATION.md](docs/DISCORD_INTEGRATION.md)     | OAuth & bot plans                       |
| [docs/AI_SAFETY.md](docs/AI_SAFETY.md)                         | Human-in-the-loop AI policy             |
| [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) | Honest done vs planned matrix           |
| [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md)         | Local/dev constraints                   |
| [docs/CHANGELOG.md](docs/CHANGELOG.md)                         | Version history                         |
| [docs/DECISIONS/](docs/DECISIONS/)                             | Architecture decision records           |

## Honest status

Release 0 / early Release 1 deliver:

- Auth (magic link; Discord OAuth when credentials exist)
- Organization create / list / switch, invitation service APIs
- Permission engine + in-app simulator
- Audit event recording with secret redaction
- Health/ready probes, worker queue scaffold, ER:LC simulator

Not yet production-ready: live ER:LC commands, Discord slash commands, CAD workflows, billing checkout, MFA enforcement, Playwright e2e suite, and most domain modules beyond navigation placeholders.

See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

## License

See [LICENSE](LICENSE).
