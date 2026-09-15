import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "./auth.middleware.js";

export const authRoutes: Router = Router();

/**
 * GET /api/v1/auth/me (SYSTEM_PLAN.md §26): "returns profile + permissions +
 * departments". req.identity (from requireAuth) already carries permissions
 * and departmentIds; the fuller profile fields (employeeId, fullName, email,
 * phone) are looked up here rather than being added to the identity attached
 * by requireAuth, which stays limited to exactly what §9 specifies it
 * carries (id, role, permissions, departmentIds, status).
 */
authRoutes.get("/me", requireAuth, async (req, res, next) => {
  try {
    const identity = req.identity!;
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { id: identity.id },
      select: {
        employeeId: true,
        fullName: true,
        email: true,
        phone: true,
      },
    });

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
