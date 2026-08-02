# Testing

## Strategy

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | Permissions, validation, crypto, audit sanitize, shared IDs, package stubs |
| Integration | Vitest (`test:integration` where configured) | API/org tenant behavior, database when `DATABASE_URL` available |
| End-to-end | Playwright (planned) | Auth → create org → switch org → permission simulator; not yet required in CI |
| Static | ESLint, `tsc`, Prettier | Enforced in `pnpm quality` and GitHub Actions |
| Guardrail | ripgrep placeholder scan | Blocks `TODO: implement`, `fakeApiResponse`, `hardcodedSampleOrg` outside docs |

Philosophy: test real authorization and tenant boundaries early; do not invent mock production organizations or fake ER:LC responses in product paths.

## Running tests

```bash
pnpm test                 # turbo: unit tests across packages/apps
pnpm test:unit            # packages only
pnpm test:integration     # packages with integration configs
pnpm quality              # format:check + lint + typecheck + test + build
```

Package-level:

```bash
pnpm --filter @commandry/permissions test
pnpm --filter @commandry/api test
pnpm --filter @commandry/database test:integration
```

## Notable coverage (current)

- `authorize()` — role grants, cross-tenant deny, ownership, break-glass requirement
- Organization Zod schemas
- Credential encrypt/decrypt round-trip
- Audit metadata redaction
- Public ID generation
- Worker queue name constants / echo job wiring tests
- ER:LC simulator mode messaging
- Org service tenant tests (integration config present)

## Quality gates (CI)

`.github/workflows/ci.yml` on `main` and PRs:

1. Install with frozen lockfile (Node 22, pnpm 10)
2. `pnpm db:generate`
3. Format check, lint, typecheck
4. Migrate against service Postgres
5. `pnpm test`
6. `pnpm build`
7. Forbidden placeholder scan on `apps` / `packages`

CI provides Postgres 16 and Redis 7 as services with secrets suitable only for ephemeral runners.

## Playwright plan (not yet landed)

When introduced under `apps/web` or a dedicated e2e package:

1. Magic-link (or test auth hook) sign-in against local stack
2. Create organization + assert redirect/onboarding
3. Switch organization
4. Permission simulator shows owner allows / member denies
5. Assert module pages show foundation badges — not fake data
6. Run in CI against compose stack; keep secrets out of traces

Until then, Vitest + CI quality gate are the merge bar.

## Conventions

- Prefer testing public package exports
- Use `@commandry/testing` helpers for request IDs
- Never assert against plaintext secrets in logs/audit fixtures
- Integration tests should skip cleanly or use `DATABASE_URL_TEST` when isolation is required
