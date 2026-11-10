import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { AuthError, ForbiddenError } from "../../lib/errors.js";
import { verifySupabaseAccessToken } from "./jwt.js";
import { runWithUserContext } from "../../lib/request-context.js";
import type { RequestIdentity } from "./auth.types.js";

const BEARER_PREFIX = "Bearer ";

// Supabase `sub` claims are auth.users UUIDs; anything else can't match a profile.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AuthProfileRow {
  id: string;
  status: RequestIdentity["status"];
  employee_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role_id: string | null;
  role_code: string | null;
  role_name: string | null;
  permissions: string[];
  department_ids: string[];
}

/**
 * The caller's profile, role, permission codes and department ids in ONE
 * statement. The equivalent nested `prisma.profile.findUnique` issues a
 * separate SQL round trip per relation (profile, role, role_permissions,
 * permissions, user_departments), and this lookup runs on every
 * authenticated request, so each round trip to the database is paid on every
 * API call. Runs as the caller under the same RLS policies as before
 * (`$queryRawWithUserContext`), so it can return only rows the nested reads
 * could.
 */
function loadAuthProfile(userId: string): Promise<AuthProfileRow[]> {
  return prisma.$queryRawWithUserContext<AuthProfileRow[]>(Prisma.sql`
    SELECT
      p.id::text AS id,
      p.status::text AS status,
      p.employee_id,
      p.full_name,
      p.email::text AS email,
      p.phone,
      r.id::text AS role_id,
      r.code AS role_code,
      r.name AS role_name,
      COALESCE(
        (SELECT array_agg(pm.code ORDER BY pm.code)
           FROM public.role_permissions rp
           JOIN public.permissions pm ON pm.id = rp.permission_id
          WHERE rp.role_id = r.id),
        ARRAY[]::text[]
      ) AS permissions,
      COALESCE(
        (SELECT array_agg(ud.department_id::text ORDER BY ud.department_id)
           FROM public.user_departments ud
          WHERE ud.user_id = p.id),
        ARRAY[]::text[]
      ) AS department_ids
    FROM public.profiles p
    LEFT JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = ${userId}::uuid
  `);
}

/**
 * requireAuth (SYSTEM_PLAN.md §9/§10): verifies the Supabase JWT, loads the
 * corresponding profile (role + permissions + department memberships), and
 * attaches the result as req.identity. Rejects a missing/invalid/expired
 * token and a missing profile with a generic 401 (no distinction in the
 * response, per §9's anti-token-forging-aid rule); rejects a profile whose
 * status isn't ACTIVE with 403, exactly as §9 specifies.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization");
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      throw new AuthError();
    }
    const token = header.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      throw new AuthError();
    }

    const jwtStarted = performance.now();
    const userId = await verifySupabaseAccessToken(token);
    res.append("Server-Timing", `jwt;dur=${(performance.now() - jwtStarted).toFixed(1)}`);
    if (!UUID_PATTERN.test(userId)) {
      throw new AuthError();
    }

    // Everything from here on — starting with this very profile lookup —
    // must run with this user's identity visible to Postgres RLS
    // (lib/prisma.ts's query extension reads it via request-context.ts).
    // Opening the context here, before the first query, closes the
    // otherwise-obvious bootstrap gap: the `profiles` RLS policy (`id =
    // auth.uid()`) correctly allows a user to read their own row on this
    // first lookup, and `next()` is called from inside this same scope so
    // the entire downstream route handler inherits it too (Phase 2H).
    await runWithUserContext(userId, async () => {
      const profileStarted = performance.now();
      const [profile] = await loadAuthProfile(userId);
      res.append("Server-Timing", `auth_db;dur=${(performance.now() - profileStarted).toFixed(1)}`);

      if (!profile) {
        throw new AuthError();
      }

      if (profile.status !== "ACTIVE") {
        throw new ForbiddenError("This account is not active.");
      }

      if (!profile.role_id || !profile.role_code || !profile.role_name) {
        // role_id is NOT NULL with an FK, so this means the role row wasn't
        // readable — a server fault, not a credentials problem (the previous
        // nested read failed the same way).
        throw new Error("Authenticated profile's role could not be loaded.");
      }

      const identity: RequestIdentity = {
        id: profile.id,
        role: { id: profile.role_id, code: profile.role_code, name: profile.role_name },
        permissions: profile.permissions,
        departmentIds: profile.department_ids,
        status: profile.status,
      };

      req.identity = identity;
      req.authProfile = {
        employeeId: profile.employee_id,
        fullName: profile.full_name,
        email: profile.email,
        phone: profile.phone,
      };
      next();
    });
  } catch (error) {
    next(error);
  }
}
