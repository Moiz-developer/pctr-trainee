import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { AuthError, ForbiddenError } from "../../lib/errors.js";
import { verifySupabaseAccessToken } from "./jwt.js";
import { runWithUserContext } from "../../lib/request-context.js";
import type { RequestIdentity } from "./auth.types.js";

const BEARER_PREFIX = "Bearer ";

/**
 * requireAuth (SYSTEM_PLAN.md §9/§10): verifies the Supabase JWT, loads the
 * corresponding profile (role + permissions + department memberships), and
 * attaches the result as req.identity. Rejects a missing/invalid/expired
 * token and a missing profile with a generic 401 (no distinction in the
 * response, per §9's anti-token-forging-aid rule); rejects a profile whose
 * status isn't ACTIVE with 403, exactly as §9 specifies.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization");
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      throw new AuthError();
    }
    const token = header.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      throw new AuthError();
    }

    const userId = await verifySupabaseAccessToken(token);

    // Everything from here on — starting with this very profile lookup —
    // must run with this user's identity visible to Postgres RLS
    // (lib/prisma.ts's query extension reads it via request-context.ts).
    // Opening the context here, before the first query, closes the
    // otherwise-obvious bootstrap gap: the `profiles` RLS policy (`id =
    // auth.uid()`) correctly allows a user to read their own row on this
    // first lookup, and `next()` is called from inside this same scope so
    // the entire downstream route handler inherits it too (Phase 2H).
    await runWithUserContext(userId, async () => {
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
          role: {
            select: {
              id: true,
              code: true,
              name: true,
              rolePermissions: {
                select: { permission: { select: { code: true } } },
              },
            },
          },
          memberships: {
            select: { departmentId: true },
          },
        },
      });

      if (!profile) {
        throw new AuthError();
      }

      if (profile.status !== "ACTIVE") {
        throw new ForbiddenError("This account is not active.");
      }

      const identity: RequestIdentity = {
        id: profile.id,
        role: { id: profile.role.id, code: profile.role.code, name: profile.role.name },
        permissions: profile.role.rolePermissions.map((rp) => rp.permission.code),
        departmentIds: profile.memberships.map((m) => m.departmentId),
        status: profile.status,
      };

      req.identity = identity;
      next();
    });
  } catch (error) {
    next(error);
  }
}
