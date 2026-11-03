import { Router } from "express";
import { requireAuth } from "./auth.middleware.js";

export const authRoutes: Router = Router();

/**
 * GET /api/v1/auth/me (SYSTEM_PLAN.md §26): "returns profile + permissions +
 * departments". req.identity (from requireAuth) already carries permissions
 * and departmentIds; the fuller profile fields (employeeId, fullName, email,
 * phone) reuse the profile loaded by requireAuth on this same request.
 * No cross-request cache is used; role/status changes are still checked
 * against the database on every authenticated request.
 */
authRoutes.get("/me", requireAuth, async (req, res, next) => {
  try {
    const identity = req.identity!;
    const profile = req.authProfile!;

    res.json({
      data: {
        id: identity.id,
        employeeId: profile.employeeId,
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        status: identity.status,
        role: identity.role,
        permissions: identity.permissions,
        departmentIds: identity.departmentIds,
      },
    });
  } catch (error) {
    next(error);
  }
});
