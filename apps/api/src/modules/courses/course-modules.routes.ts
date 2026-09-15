import { Router } from "express";
import { z } from "zod";
import {
  createCourseModuleRequestSchema,
  updateCourseModuleRequestSchema,
  listCourseModulesQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createCourseModule,
  getCourseModule,
  listCourseModules,
  updateCourseModule,
} from "./course-modules.service.js";
import { courseLessonsRoutes } from "./course-lessons.routes.js";

// mergeParams: true — this router is mounted at /:courseId/modules under
// courses.routes.ts, and needs req.params.courseId from the parent route.
export const courseModulesRoutes: Router = Router({ mergeParams: true });

// Course Lessons (SYSTEM_PLAN.md §14.2, Phase 2 Unit 2.4) are a sub-resource
// of modules — mounted here using "moduleId" (not "id") for this path
// segment specifically so it doesn't collide with this router's own "/:id"
// module-level routes below once merged with the lesson router's own "id"
// param for the lesson itself (mergeParams would otherwise silently shadow
// one "id" with the other).
courseModulesRoutes.use("/:moduleId/lessons", courseLessonsRoutes);

const paramsSchema = z.object({ courseId: z.string().min(1), id: z.string().min(1) });
const courseIdParamsSchema = z.object({ courseId: z.string().min(1) });

/**
 * Same permission mapping as courses.routes.ts (SYSTEM_PLAN.md §5/§10):
 * `course.view` for reads, `course.create` for writes — no dedicated module
 * permission exists in the seed, and this unit is explicitly told not to
 * add one.
 */

courseModulesRoutes.get(
  "/",
  requireAuth,
  requirePermission("course.view"),
  async (req, res, next) => {
    try {
      const parsedParams = courseIdParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedQuery = listCourseModulesQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listCourseModules(parsedParams.data.courseId, parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

courseModulesRoutes.get(
  "/:id",
  requireAuth,
  requirePermission("course.view"),
  async (req, res, next) => {
    try {
      const parsedParams = paramsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await getCourseModule(parsedParams.data.courseId, parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

courseModulesRoutes.post(
  "/",
  requireAuth,
  requirePermission("course.create"),
  async (req, res, next) => {
    try {
      const parsedParams = courseIdParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = createCourseModuleRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await createCourseModule(parsedParams.data.courseId, parsedBody.data);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

courseModulesRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("course.create"),
  async (req, res, next) => {
    try {
      const parsedParams = paramsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateCourseModuleRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateCourseModule(
        parsedParams.data.courseId,
        parsedParams.data.id,
        parsedBody.data,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
