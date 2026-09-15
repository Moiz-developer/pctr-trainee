import { Router } from "express";
import { z } from "zod";
import {
  createCourseCategoryRequestSchema,
  updateCourseCategoryRequestSchema,
  listCourseCategoriesQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createCourseCategory,
  getCourseCategory,
  listCourseCategories,
  updateCourseCategory,
} from "./course-categories.service.js";

export const courseCategoriesRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

/**
 * Permission mapping: `course.create` (SYSTEM_PLAN.md §5, the only "author
 * course-related data" permission the seed defines — see courses.routes.ts's
 * own identical reasoning for why no `course.update`/`category.manage` code
 * is invented). Categories are course-authoring metadata, gated the same way
 * courses themselves are; read routes share the same permission as write
 * routes, matching the department admin routes' precedent (no separate
 * `*.view` permission exists for either).
 */

courseCategoriesRoutes.get(
  "/",
  requireAuth,
  requirePermission("course.create"),
  async (req, res, next) => {
    try {
      const parsedQuery = listCourseCategoriesQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listCourseCategories(parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

courseCategoriesRoutes.get(
  "/:id",
  requireAuth,
  requirePermission("course.create"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await getCourseCategory(parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

courseCategoriesRoutes.post(
  "/",
  requireAuth,
  requirePermission("course.create"),
  async (req, res, next) => {
    try {
      const parsedBody = createCourseCategoryRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await createCourseCategory(parsedBody.data);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

courseCategoriesRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("course.create"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateCourseCategoryRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateCourseCategory(parsedParams.data.id, parsedBody.data);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
