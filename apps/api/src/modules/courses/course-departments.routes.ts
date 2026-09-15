import { Router } from "express";
import { z } from "zod";
import { setCourseDepartmentsRequestSchema } from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import { listCourseDepartments, setCourseDepartments } from "./course-departments.service.js";

// mergeParams: true — mounted at /:courseId/departments under courses.routes.ts.
export const courseDepartmentsRoutes: Router = Router({ mergeParams: true });

const courseParamsSchema = z.object({ courseId: z.string().min(1) });

/**
 * Permission `department.manage` for both routes — see this unit's
 * implementation report / packages/shared/src/api/course-departments.ts.
 */

courseDepartmentsRoutes.get(
  "/",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = courseParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await listCourseDepartments(parsedParams.data.courseId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

courseDepartmentsRoutes.put(
  "/",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = courseParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = setCourseDepartmentsRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await setCourseDepartments(
        parsedParams.data.courseId,
        parsedBody.data.department_ids,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
