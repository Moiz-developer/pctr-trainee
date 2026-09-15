import { Router } from "express";
import { z } from "zod";
import {
  createUserRequestSchema,
  updateUserRequestSchema,
  assignUserDepartmentRequestSchema,
  listUsersQuerySchema,
  grantUserCourseAccessRequestSchema,
  listCourseAccessQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  assignUserDepartment,
  createUser,
  listUsers,
  removeUserDepartment,
  updateUser,
} from "./users.service.js";
import {
  grantCourseAccess,
  listCourseAccessForUser,
  revokeCourseAccess,
} from "../courses/course-access.service.js";

export const usersRoutes: Router = Router();

const userIdParamsSchema = z.object({ id: z.string().min(1) });
const userDepartmentParamsSchema = z.object({
  id: z.string().min(1),
  departmentId: z.string().min(1),
});
const userCourseAccessRevokeParamsSchema = z.object({
  id: z.string().min(1),
  courseId: z.string().min(1),
});

/**
 * GET /api/v1/admin/users (new — see this unit's implementation report).
 * Gated by `user.manage`: the existing "manage users" permission, since no
 * dedicated `user.view` permission exists in the seed and this unit is
 * told not to invent one.
 */
usersRoutes.get("/", requireAuth, requirePermission("user.manage"), async (req, res, next) => {
  try {
    const parsedQuery = listUsersQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
    }
    const { items, meta } = await listUsers(parsedQuery.data);
    res.json({ data: items, meta });
  } catch (error) {
    next(error);
  }
});

/**
 * SYSTEM_PLAN.md §26: POST /admin/users requires the `user.create`
 * permission (not a role-name check) — see modules/authorization.
 */
usersRoutes.post("/", requireAuth, requirePermission("user.create"), async (req, res, next) => {
  try {
    const parsedBody = createUserRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new ValidationError(parsedBody.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      // Unreachable in practice (requireAuth runs first), kept only to satisfy
      // strict typing on req.identity without an unsafe assertion.
      throw new Error("Missing authenticated identity.");
    }

    const result = await createUser(parsedBody.data, identity.id);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

/** SYSTEM_PLAN.md §26: PATCH /admin/users/:id requires `user.manage`. */
usersRoutes.patch("/:id", requireAuth, requirePermission("user.manage"), async (req, res, next) => {
  try {
    const parsedParams = userIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }
    const parsedBody = updateUserRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new ValidationError(parsedBody.error.flatten().fieldErrors);
    }

    const result = await updateUser(parsedParams.data.id, parsedBody.data);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/users/:id/departments — assigns a department to a user
 * (SYSTEM_PLAN.md §40's user-department assignment deliverable). Permission
 * is `department.manage`, not `user.manage`: the plan groups departments and
 * `user_departments` together as one "Department & Access Model" (§6),
 * distinct from user/profile CRUD (§9), and `department.manage` is the only
 * department-related permission the plan defines — see this unit's
 * implementation report for the full reasoning.
 */
usersRoutes.post(
  "/:id/departments",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = userIdParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = assignUserDepartmentRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        // Unreachable in practice (requireAuth runs first), kept only to satisfy
        // strict typing on req.identity without an unsafe assertion.
        throw new Error("Missing authenticated identity.");
      }

      const result = await assignUserDepartment(parsedParams.data.id, parsedBody.data, identity.id);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /admin/users/:id/departments/:departmentId — removes a department
 * assignment (new — Admin Users + Departments UI unit). Same permission as
 * assign (`department.manage`, same resource). See users.service.ts's
 * `removeUserDepartment` for why a hard delete is schema-correct here.
 */
usersRoutes.delete(
  "/:id/departments/:departmentId",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = userDepartmentParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await removeUserDepartment(
        parsedParams.data.id,
        parsedParams.data.departmentId,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Training Access assignment inside User Management unit: a user-centric
 * view of the existing `course_access` table, reached from the Admin Users
 * page rather than a specific course's admin page. Gated by the SAME
 * `course.access.manage` permission the course-side access.routes.ts
 * already uses (§3/§7 of this unit — reuse the existing authorization, no
 * new permission). Grant/revoke below call the EXISTING
 * `grantCourseAccess`/`revokeCourseAccess` service functions directly (the
 * same ones course-access.routes.ts calls) — only the list direction needed
 * a new query (`listCourseAccessForUser`, filtered by user_id instead of
 * course_id, same table/mapper). This is entirely separate from department
 * membership (`user_departments`) — untouched by any of these three routes.
 */

usersRoutes.get(
  "/:id/course-access",
  requireAuth,
  requirePermission("course.access.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = userIdParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedQuery = listCourseAccessQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listCourseAccessForUser(
        parsedParams.data.id,
        parsedQuery.data,
      );
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

usersRoutes.post(
  "/:id/course-access",
  requireAuth,
  requirePermission("course.access.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = userIdParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = grantUserCourseAccessRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        // Unreachable in practice (requireAuth runs first), kept only to satisfy
        // strict typing on req.identity without an unsafe assertion.
        throw new Error("Missing authenticated identity.");
      }

      const { response, status } = await grantCourseAccess(
        parsedBody.data.course_id,
        { user_id: parsedParams.data.id },
        identity.id,
      );
      res.status(status).json({ data: response });
    } catch (error) {
      next(error);
    }
  },
);

usersRoutes.delete(
  "/:id/course-access/:courseId",
  requireAuth,
  requirePermission("course.access.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = userCourseAccessRevokeParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const result = await revokeCourseAccess(
        parsedParams.data.courseId,
        parsedParams.data.id,
        identity.id,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
