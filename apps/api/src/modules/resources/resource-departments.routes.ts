import { Router } from "express";
import { z } from "zod";
import { setResourceDepartmentsRequestSchema } from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import { listResourceDepartments, setResourceDepartments } from "./resource-departments.service.js";

// mergeParams: true — mounted at /:resourceId/departments under admin-resources.routes.ts.
export const resourceDepartmentsRoutes: Router = Router({ mergeParams: true });

const resourceParamsSchema = z.object({ resourceId: z.string().min(1) });

/** Permission `department.manage` for both routes — mirrors course-departments.routes.ts exactly. */

resourceDepartmentsRoutes.get(
  "/",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = resourceParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await listResourceDepartments(parsedParams.data.resourceId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

resourceDepartmentsRoutes.put(
  "/",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = resourceParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = setResourceDepartmentsRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await setResourceDepartments(
        parsedParams.data.resourceId,
        parsedBody.data.department_ids,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
