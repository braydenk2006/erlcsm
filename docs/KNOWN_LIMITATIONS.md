# Known limitations

Constraints for local development and early releases. These are intentional, not accidental omissions.

## Local infrastructure

- **Docker is not required** if PostgreSQL 16 and Redis 7 are already reachable with URLs matching `.env`.
- Compose also starts Mailpit and MinIO; the app does not depend on them for R0/R1 core flows.
- `pnpm db:seed` is diagnostic — it does not create demo production-like organizations.

## Credentials & integrations

- **Discord OAuth** needs `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`; otherwise Discord sign-in is unavailable.
- **Discord bot** needs `DISCORD_BOT_TOKEN`; without it the bot process stays in idle diagnostic mode.
- **ER:LC** defaults to simulator mode; there is no live server connection in 0.1.0.
- **Resend** unset → magic links print to server logs (development adapter).
- **Stripe / S3 / Sentry / OTEL / AI** env vars are reserved; runtimes are not wired.

## Product modules

- Most `/app/*` module routes are **scaffolded** with foundation-only empty states.
- Invitation accept/update organization HTTP routes are not fully exposed; services exist in `@commandry/api`.
- Billing plan limits are constants only — not enforced on every request path.
- Support impersonation, break-glass UX, custom domains, and MFA enrollment are schema/engine-ready at best.

## Auth & email

- Email/password authentication is disabled by design in this phase.
- Production-grade email delivery and deliverability monitoring are not implemented.

## Testing

- Playwright e2e is a documented strategy, not an active CI suite yet.
- Integration tests require a migrated database when exercised.

## Security expectations

- Do not expose local Redis/Postgres ports on public networks.
- Rotating `CREDENTIALS_ENCRYPTION_KEY` without re-encrypting rows makes stored secrets unreadable.
- Treat any deployment of 0.1.0 as pre-production foundation software.
