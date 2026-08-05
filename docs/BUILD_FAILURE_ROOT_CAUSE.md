# Production Build Failure — Root Cause & Fix

## Symptoms

- CI (`pnpm build`) failed: `Failed to collect page data for /api/organizations`, preceded by
  `Error: BETTER_AUTH_SECRET must be set to at least 32 characters`.
- Local builds also failed prerendering `/_global-error`:
  `TypeError: Cannot read properties of null (reading 'useContext')`.

There were **two independent root causes** plus a strict-env interaction.

## Root cause 1 — Better Auth created at import time

`packages/auth/src/server.ts` executed `const authInstance = createAuth();` at module
load. `createAuth()` calls `assertAuthSecret(process.env.BETTER_AUTH_SECRET)`. During
`next build`, the "collect page data" phase imports every route module; each route
transitively imports the session helper → `@commandry/auth/server` → `createAuth()`,
which throws when `BETTER_AUTH_SECRET` is absent. Build workers do not (and should not)
have runtime secrets, so the build failed on the first route.

This was amplified by **Turbo's default strict env mode**, which strips undeclared env
vars (including `BETTER_AUTH_SECRET`) from the `build` task, so even a CI job that sets
the secret does not pass it to the build.

**Fix (root cause, no suppression):** defer auth creation to first use.

- `packages/auth/src/server.ts` now exports `getAuth()` (memoized) instead of an eager
  `auth` singleton.
- `apps/web/src/lib/session.ts` calls `getAuth().api.getSession(...)`.
- `apps/web/src/app/api/auth/[...all]/route.ts` calls `getAuth().handler(request)` inside
  the GET/POST handlers instead of building handlers from a module-scope `auth`.

Runtime behavior is unchanged; the secret is still required and validated on first
request. Auth and tenant isolation are not weakened.

## Root cause 2 — authenticated pages statically prerendered

After fix 1, the build reached static generation and failed on `/app/cad` (and siblings)
because Next attempted to statically prerender session-dependent pages, invoking
`getSession()` at build time.

**Fix (technically justified):** every route under `/app` is authenticated and renders
per-user, per-organization data derived from the session cookie, so it is inherently
dynamic. `apps/web/src/app/app/layout.tsx` now sets `export const dynamic = "force-dynamic"`.
This is scoped to the authenticated segment only — the landing page and sign-in remain
static.

## Root cause 3 — `/_global-error` crash under non-production `NODE_ENV`

Building Next 16 with a non-production `NODE_ENV` (e.g. `NODE_ENV=development` leaking from
`.env`) bundles the **development** React runtime, which crashes while prerendering the
framework's internal `/_global-error` page (`useContext` of `null`). Verified:
`NODE_ENV=production` and `NODE_ENV=test` (CI's value) build cleanly; only
`NODE_ENV=development` fails.

**Fix (root cause):** pin the production build/start to production mode.

- `apps/web/package.json`: `"build": "NODE_ENV=production next build"`,
  `"start": "NODE_ENV=production next start --port 3000"`.
- Added a self-contained `apps/web/src/app/global-error.tsx` (branded, provider-free) as a
  proper runtime global error boundary.

## Constraints honored

- No type checking disabled; no lint rules disabled.
- No routes marked dynamic beyond the genuinely-dynamic authenticated segment.
- No authentication or tenant isolation weakened.
- No application functionality removed.

## Verification

`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm quality` all pass — including when the shell environment has `NODE_ENV=development`
and no runtime secrets (the strict-env / dev-polluted worst case). See
`PRODUCTION_VERIFICATION.md` for production startup evidence.
