# Deployment

R0/R1 targets a simple deployable shape: Next.js web, BullMQ worker, optional Discord bot, managed Postgres + Redis. `infra/deployment` and `infra/monitoring` are reserved directories — production IaC is not checked in yet.

## Environment variables

See `.env.example`. Required for a functional app:

| Variable                      | Purpose                                  |
| ----------------------------- | ---------------------------------------- |
| `DATABASE_URL`                | Postgres connection string               |
| `REDIS_URL`                   | Redis for BullMQ                         |
| `APP_URL` / `BETTER_AUTH_URL` | Public origin                            |
| `BETTER_AUTH_SECRET`          | ≥ 32 chars                               |
| `CREDENTIALS_ENCRYPTION_KEY`  | ≥ 32 chars; encrypts integration secrets |

Optional / feature-gated:

| Variable                                      | Effect when unset              |
| --------------------------------------------- | ------------------------------ |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord OAuth disabled         |
| `DISCORD_BOT_TOKEN`                           | Bot idle mode                  |
| `RESEND_API_KEY`                              | Magic links logged to console  |
| `S3_*`                                        | Object storage unused          |
| `STRIPE_*`                                    | Billing runtime unused         |
| `SENTRY_DSN` / `OTEL_EXPORTER_OTLP_ENDPOINT`  | Observability exporters unused |
| `AI_PROVIDER` / `AI_API_KEY`                  | Defaults to `none`             |
| `ERLC_MODE`                                   | Defaults to `simulator`        |

Validate shapes with `envSchema` from `@commandry/validation` when wiring boot checks.

## Local Docker

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Services: Postgres 16 (`commandry` / `commandry_test`), Redis 7, Mailpit (1025/8025), MinIO (9000/9001).

Docker is optional if equivalent Postgres/Redis are already available.

## Process model

| Process     | Command (dev)                                     | Notes                         |
| ----------- | ------------------------------------------------- | ----------------------------- |
| Web         | `pnpm --filter @commandry/web dev`                | Port 3000                     |
| Worker      | `pnpm --filter @commandry/worker dev` (via turbo) | Requires Redis + DB           |
| Discord bot | turbo `dev`                                       | Exits idle path without token |

Production-ish:

```bash
pnpm db:migrate:deploy
pnpm build
pnpm --filter @commandry/web start
# separately: node/worker start entry for apps/worker
```

## Staging outline

1. Provision Postgres 16 and Redis 7 (private network).
2. Set secrets via a secret manager; never commit `.env`.
3. Run migrate deploy as a release step before flipping traffic.
4. Deploy web (container or Node host) with health checks on `/api/health` and `/api/ready`.
5. Deploy worker with the same image/commit as web for schema compatibility.
6. Leave `ERLC_MODE=simulator` and Discord bot optional until credentials + R5 readiness.
7. Use Stripe test keys only; do not enable live webhooks until signature verification exists.
8. Seed is **not** required for staging; avoid fabricating demo tenant data that looks production-real.

## Production outline

Same as staging, plus:

- TLS termination and locked-down DB/Redis
- Distinct `CREDENTIALS_ENCRYPTION_KEY` and auth secrets; rotation plan
- Horizontal web replicas; single or HA worker consumers with concurrency limits
- Backups for Postgres; Redis persistence policy for queues
- Log shipping of JSON logs; optional Sentry/OTEL when configured
- Feature flags / `AI_PROVIDER=none` until Release 8 acceptance
- Support impersonation disabled until audited workflow ships

## Rollback

1. **App rollback:** Redeploy previous web + worker artifacts that match the prior Prisma schema.
2. **Migration rollback:** Prefer forward-fix migrations. If a migration must be reverted, restore DB from pre-deploy snapshot/backup; do not casually `migrate reset` in shared environments.
3. **Config rollback:** Revert env changes (especially encryption keys — old ciphertexts become unreadable if the key changes without re-encryption).
4. **Worker:** Pause/drain queues before schema-breaking deploys; replay failed jobs from `job_failures` only after verifying idempotency.

## CI relationship

GitHub Actions already exercises migrate + test + build against ephemeral Postgres/Redis. Treat a green `quality` job as the minimum bar before promoting an image to staging.
