import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from "jose";
import { env } from "../../config/env.js";
import { AuthError } from "../../lib/errors.js";

/**
 * Supabase projects sign access tokens either with a shared HS256 secret
 * (legacy) or an asymmetric key rotated via a JWKS endpoint (current default
 * for new projects) — SYSTEM_PLAN.md §9 explicitly anticipates both: "the
 * JWT secret (or JWKS for asymmetric projects)". Which one a given token
 * needs is determined by its own `alg` header, not a fixed project setting.
 */
const remoteJwks = env.SUPABASE_URL
  ? createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", env.SUPABASE_URL))
  : undefined;

/**
 * Verifies a Supabase-issued access token: checks the signature (HS256
 * against SUPABASE_JWT_SECRET, or JWKS for asymmetric algorithms) and
 * standard expiry, then returns the `sub` claim (the Supabase
 * auth.users.id).
 *
 * Any failure (missing config, bad signature, expired, malformed) throws a
 * single generic AuthError — callers must not distinguish the reason in the
 * response, to avoid aiding token-forging attempts (§9's explicit failure-
 * handling rule).
 */
export async function verifySupabaseAccessToken(token: string): Promise<string> {
  let sub: string | undefined;

  try {
    const { alg } = decodeProtectedHeader(token);

    if (alg === "HS256") {
      if (!env.SUPABASE_JWT_SECRET) {
        throw new Error("SUPABASE_JWT_SECRET is not configured.");
      }
      const secretKey = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(token, secretKey);
      sub = typeof payload.sub === "string" ? payload.sub : undefined;
    } else {
      if (!remoteJwks) {
        throw new Error("SUPABASE_URL is not configured (required for JWKS verification).");
      }
      const { payload } = await jwtVerify(token, remoteJwks);
      sub = typeof payload.sub === "string" ? payload.sub : undefined;
    }
  } catch {
    throw new AuthError();
  }

  if (!sub) {
    throw new AuthError();
  }

  return sub;
}
