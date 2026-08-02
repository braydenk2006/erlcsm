# 0003. Prisma + PostgreSQL

Date: 2026-08-02  
Status: Accepted

## Context

The data model is relational and multi-tenant: organizations, memberships, roles, grants, audit, encrypted credentials. The team wants type-safe queries, migrations, and a single source-of-truth schema for a modular monolith.

## Decision

Use **PostgreSQL 16** with **Prisma 7** and the **`@prisma/adapter-pg`** driver adapter (`pg` Pool).

- Schema in `packages/database/prisma/schema.prisma`
- Generated client under the database package
- Migrate via `pnpm db:migrate` / `db:migrate:deploy`
- Soft deletes and status enums for tenant lifecycle

## Consequences

**Positive**

- Strong typing across `@commandry/api` and apps
- Portable migrations for CI and staging/prod
- Mature ecosystem for Postgres ops and backups

**Trade-offs**

- Prisma client generation is a required install/CI step
- Complex authorization still lives in application code (`authorize()`), not only in RLS (Postgres RLS may be considered later)
- Driver adapter configuration differs from older Prisma defaults — document connection via `DATABASE_URL`
