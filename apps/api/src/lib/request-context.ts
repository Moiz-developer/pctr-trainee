import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Phase 2H (RLS + non-bypassing DB role). Carries the current request's
 * authenticated user id across the async call chain — from
 * `auth.middleware.ts` (where it's first known, right after JWT
 * verification) through every downstream `await prisma.*` call — WITHOUT
 * threading it through every service function's parameters. This is what
 * lets `lib/prisma.ts`'s query extension propagate identity into Postgres
 * (`set_config('request.jwt.claim.sub', ...)`) for every existing call site
 * with zero changes to any of those call sites.
 */
const requestContext = new AsyncLocalStorage<{ userId: string }>();

export function runWithUserContext<T>(userId: string, fn: () => T): T {
  return requestContext.run({ userId }, fn);
}

export function getCurrentUserId(): string | undefined {
  return requestContext.getStore()?.userId;
}
