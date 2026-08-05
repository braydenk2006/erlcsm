import { createAuth, type Auth } from "./auth";

let cachedAuth: Auth | undefined;

/**
 * Lazily create and memoize the Better Auth instance.
 *
 * `createAuth()` asserts `BETTER_AUTH_SECRET` (and touches Prisma). Instantiating
 * it at module-import time made `next build` fail while collecting page data for
 * every route that transitively imports auth, because build workers do not have
 * runtime secrets. Deferring creation to first request keeps the production build
 * free of runtime-secret requirements without weakening auth at runtime.
 */
export function getAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = createAuth();
  }
  return cachedAuth;
}

export type Session = Auth["$Infer"]["Session"];
