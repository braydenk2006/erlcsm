# Changelog

All notable changes to Commandry are documented here. Format inspired by [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] — 2026-08-02

### Foundations (Release 0 / early Release 1)

#### Added

- pnpm workspaces + Turborepo monorepo (`apps/*`, `packages/*`)
- Next.js 16 App Router web app with landing, sign-in, app shell, onboarding, module placeholders, permission simulator
- Better Auth integration: magic link (dev console adapter), optional Discord OAuth
- PostgreSQL schema via Prisma 7 (`@prisma/adapter-pg`) covering identity, tenancy, roles, ranks, departments, permissions, audit, integration credentials, support sessions, job failures
- Organization create / list / switch REST endpoints and invitation service APIs
- `@commandry/permissions` with `authorize()`, system roles, and explainable access
- `@commandry/audit` append recording with sensitive-field redaction
- AES-256-GCM credential encryption helpers
- BullMQ worker with system queue (`health.check`, `demo.echo`) and `JobFailure` persistence
- Discord bot scaffold (idle without token)
- ER:LC simulator client (`ERLC_MODE=simulator`)
- Shared UI package (Tailwind CSS 4 tokens: teal operational palette, Sora/Fraunces)
- Zod validation for organizations and env
- Structured logging with secret redaction
- Docker Compose for Postgres, Redis, Mailpit, MinIO
- GitHub Actions CI quality gate (format, lint, typecheck, migrate, test, build, placeholder scan)
- Documentation set under `docs/` and root `README.md`

#### Notes

- Domain modules (people, staff, CAD, moderation workflows, etc.) are navigable scaffolds only
- Live ER:LC, Discord slash commands, Stripe runtime, and AI features are not included in 0.1.0
