# AGENTS.md

## Cursor Cloud specific instructions

Standard setup, scripts, and architecture are documented in `README.md` and `docs/`. This section only records non-obvious, durable gotchas discovered while running this repo in the Cursor Cloud environment. The update script already runs `pnpm install` + `pnpm db:generate` on startup, so those are not repeated here.

### Backing services (Postgres + Redis) are local system services, not Docker
Docker is not installed in this environment. PostgreSQL 16 and Redis 7 are installed via `apt` and run as system services. They do **not** auto-start on a fresh pod, so start them before running the app or tests:

```bash
sudo service postgresql start
sudo service redis-server start
```

Database: user `commandry` / password `commandry`, databases `commandry` and `commandry_test` (both owned by `commandry`, reachable over TCP at `localhost:5432`). Redis is at `localhost:6379`. These match the defaults in `.env.example`. If the databases are missing after a fresh boot, recreate them with `sudo -u postgres createdb -O commandry commandry` (and `commandry_test`) and re-run `pnpm db:migrate`.

### A root `.env` is required and must be exported into the shell
`.env` is git-ignored. Create it once with `cp .env.example .env`, then set `BETTER_AUTH_SECRET` and `CREDENTIALS_ENCRYPTION_KEY` to 32+ char values (`openssl rand -base64 32`). The other defaults already point at the local Postgres/Redis.

Critically, the apps read configuration directly from `process.env`: the worker has no dotenv loader, and Next.js only auto-loads `.env` from `apps/web`, not the repo root. So you must export the root `.env` into the shell before running anything that needs it (migrations, `pnpm dev`, tests):

```bash
set -a && . ./.env && set +a
```

### `pnpm dev`/`pnpm test` require Turbo loose env mode
Turbo defaults to **strict** env mode, which strips undeclared env vars (`DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, …) before they reach the app processes. Symptoms of forgetting this: the worker exits with `REDIS_URL is required` and the web app's `/api/ready` returns 503 (`database: unavailable`). Run dev with loose env mode so the exported vars pass through:

```bash
set -a && . ./.env && set +a && pnpm dev --env-mode=loose
```

Verify the stack is healthy: `curl -s http://localhost:3000/api/ready` should return `{"ready":true}` (HTTP 200), and the worker log should show `Commandry worker started` followed by `Health check job succeeded`. The Discord bot logs `DISCORD_BOT_TOKEN is not configured; bot idle mode active` — that is expected without a token.

### `pnpm build` / `pnpm quality` are pre-existing broken on this branch
`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass. `pnpm build` fails during Next.js static analysis of the web app (fails collecting page data for `/api/organizations` and prerendering the default `/_global-error` page under Next 16 + React 19). This failure also occurs in CI on this branch, so it is not an environment issue. Use `pnpm dev` for running/verifying the product; do not expect the production build to succeed until that app-code issue is fixed.

### Magic-link auth prints the link to server logs
Email/password auth is disabled; sign-in is magic-link only. With `RESEND_API_KEY` unset (the dev default), the magic link is not emailed — it is written to the dev server logs as `[auth:dev] Magic link for <email>: <url>`. To complete a login in tests, request the link (POST `/api/auth/sign-in/magic-link`), grab the URL from the running `pnpm dev` output, and navigate to it. Organizations can then be created via the onboarding form or `POST /api/organizations`.
