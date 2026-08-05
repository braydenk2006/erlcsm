# Production Verification

Evidence that Ordinex produces and runs a production build. All commands run in the
Cursor Cloud Linux environment with PostgreSQL 16 + Redis running locally.

## Build & quality gates

Run with a deliberately dev-polluted shell (`NODE_ENV=development` exported, worst case):

| Command             | Result                                              |
| ------------------- | --------------------------------------------------- |
| `pnpm format:check` | Pass — "All matched files use Prettier code style!" |
| `pnpm lint`         | Pass — 35/35 tasks                                  |
| `pnpm typecheck`    | Pass — 35/35 tasks                                  |
| `pnpm test`         | Pass — 35/35 tasks                                  |
| `pnpm build`        | Pass — 46/46 tasks                                  |
| `pnpm quality`      | Pass (format + lint + typecheck + test + build)     |

Also verified `pnpm build` passes with **runtime env stripped** (Turbo strict-mode / CI
equivalent) and under `NODE_ENV=test` (CI's value) and `NODE_ENV=production`.

## Production runtime

Production processes started (not dev mode):

- **Web**: `NODE_ENV=production next start --port 3000` → `✓ Ready`.
- **Worker**: `pnpm --filter @commandry/worker start` → `Ordinex worker started`,
  `Health check job succeeded` (BullMQ/Redis), `ER:LC maintenance completed`.
- **Discord bot**: `pnpm --filter @commandry/discord-bot start` →
  `DISCORD_BOT_TOKEN is not configured; bot idle mode active` (expected idle state).

### Endpoint verification (production)

| Check                         | Result                                             |
| ----------------------------- | -------------------------------------------------- |
| `GET /api/health`             | `200` `{"status":"ok"}`                            |
| `GET /api/ready` (DB)         | `200` `{"ready":true}`                             |
| Redis                         | Worker BullMQ health-check job succeeded           |
| Auth (magic link → verify)    | `200` then `302` (session established)             |
| Organization creation         | `201` (new org created)                            |
| CAD command center            | `200`                                              |
| CAD create call               | `201`, call number `2026-000001`, status `PENDING` |
| ER:LC simulator snapshot      | `ok:true`, mode `simulator`, 21 players            |
| Unauthenticated CAD access    | `401`                                              |
| Cross-tenant CAD read (IDOR)  | `404` (org-scoped)                                 |
| Cross-tenant CAD write (IDOR) | no effect (target call unchanged)                  |
| Production web error log      | no runtime errors                                  |

## Status

The production build, migrations, unit/integration tests, and production startup all
succeed. This confirms **production build + runtime health only**. It does NOT certify the
CAD/MDT as feature-complete or production-ready as a product — see
`docs/cad/FEATURE_GAP_MATRIX.md` and `docs/cad/COMPLETION_ROADMAP.md`.
