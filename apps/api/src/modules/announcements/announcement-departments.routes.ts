import { Router } from "express";
import { z } from "zod";
import { setAnnouncementDepartmentsRequestSchema } from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  listAnnouncementDepartments,
  setAnnouncementDepartments,
} from "./announcement-departments.service.js";

// mergeParams: true — mounted at /:announcementId/departments under admin-announcements.routes.ts.
export const announcementDepartmentsRoutes: Router = Router({ mergeParams: true });

const announcementParamsSchema = z.object({ announcementId: z.string().min(1) });

/** Permission `department.manage` for both routes — mirrors resource-departments.routes.ts/course-departments.routes.ts exactly. */

announcementDepartmentsRoutes.get(
  "/",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = announcementParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await listAnnouncementDepartments(parsedParams.data.announcementId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

announcementDepartmentsRoutes.put(
  "/",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = announcementParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = setAnnouncementDepartmentsRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await setAnnouncementDepartments(
        parsedParams.data.announcementId,
        parsedBody.data.department_ids,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
