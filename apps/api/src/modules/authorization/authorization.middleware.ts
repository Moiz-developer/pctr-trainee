import type { NextFunction, Request, Response } from "express";
import { AuthError, ForbiddenError } from "../../lib/errors.js";
import { canAccessCourse } from "./access.service.js";

/**
 * requirePermission (SYSTEM_PLAN.md §5/§10): checks the permission code(s)
 * against req.identity.permissions — never a role name. ADMIN's access comes
 * entirely from holding every baseline permission via the
 * roles -> role_permissions -> permissions data (seeded in the previous
 * unit), not from a hard-coded role bypass here.
 *
 * Accepts a single code (every existing call site) or an array, meaning
 * "any of these" — added by Phase 5.2 for Policy & Procedures, where an
 * admin route (e.g. listing policies to manage) must be reachable by a
 * caller holding EITHER `policy.manage` OR `policy.version.activate`
 * (deliberately separate permissions, per that phase's own instruction).
 * Backward compatible: a single string is treated as a one-element list, so
 * no existing call site changes behavior.
 *
 * Must run after requireAuth, which populates req.identity.
 */
export function requirePermission(codes: string | string[]) {
  const required = Array.isArray(codes) ? codes : [codes];
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.identity) {
      next(new AuthError());
      return;
    }

    const identity = req.identity;
    if (!required.some((code) => identity.permissions.includes(code))) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}

/**
 * requireCourseAccess (SYSTEM_PLAN.md §10: "resource-scoped checks where
 * relevant — e.g. requireCourseAccess(courseId) calls the single
 * access-resolution function from §6"). Delegates entirely to
 * `canAccessCourse` (access.service.ts) — this middleware is a thin Express
 * adapter around that resolver, never a second place the access rule is
 * evaluated.
 *
 * Not yet mounted on any route: no user-facing course/catalogue/detail API
 * exists in this repository yet (only `/admin/courses/*`, which is
 * permission-gated administrative content management and must not require
 * ordinary course access — see this unit's implementation report). This is
 * the minimal reusable integration point the future user-facing course unit
 * will import and mount directly, so that unit doesn't have to invent it.
 *
 * `getCourseId` extracts the course id from the request (e.g. a route
 * param) — kept as a callback rather than hard-coding `req.params.courseId`
 * so this same middleware works for any future route shape. Must run after
 * requireAuth, which populates req.identity.
 */
export function requireCourseAccess(getCourseId: (req: Request) => string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.identity) {
        next(new AuthError());
        return;
      }

      const allowed = await canAccessCourse(req.identity.id, getCourseId(req));
      if (!allowed) {
        next(new ForbiddenError());
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
