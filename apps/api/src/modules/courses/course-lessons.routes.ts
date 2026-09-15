import { Router } from "express";
import { z } from "zod";
import {
  createCourseLessonRequestSchema,
  updateCourseLessonRequestSchema,
  listCourseLessonsQuerySchema,
  setLessonMediaRequestSchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createCourseLesson,
  getCourseLesson,
  listCourseLessons,
  setCourseLessonMedia,
  updateCourseLesson,
} from "./course-lessons.service.js";

// mergeParams: true — mounted at /:moduleId/lessons under
// course-modules.routes.ts, which is itself mounted at /:courseId/modules
// under courses.routes.ts, so req.params carries courseId + moduleId here.
export const courseLessonsRoutes: Router = Router({ mergeParams: true });

const hierarchyParamsSchema = z.object({
  courseId: z.string().min(1),
  moduleId: z.string().min(1),
});
const lessonParamsSchema = hierarchyParamsSchema.extend({ id: z.string().min(1) });

/**
 * Same permission mapping as courses/modules (SYSTEM_PLAN.md §5/§10):
 * `course.view` for reads, `course.create` for writes — no lesson-specific
 * permission exists in the seed, and this unit is explicitly told not to
 * add one.
 */

courseLessonsRoutes.get(
  "/",
  requireAuth,
  requirePermission("course.view"),
  async (req, res, next) => {
    try {
      const parsedParams = hierarchyParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedQuery = listCourseLessonsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listCourseLessons(
        parsedParams.data.courseId,
        parsedParams.data.moduleId,
        parsedQuery.data,
      );
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

courseLessonsRoutes.get(
  "/:id",
  requireAuth,
  requirePermission("course.view"),
  async (req, res, next) => {
    try {
      const parsedParams = lessonParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await getCourseLesson(
        parsedParams.data.courseId,
        parsedParams.data.moduleId,
        parsedParams.data.id,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

courseLessonsRoutes.post(
  "/",
  requireAuth,
  requirePermission("course.create"),
  async (req, res, next) => {
    try {
      const parsedParams = hierarchyParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = createCourseLessonRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await createCourseLesson(
        parsedParams.data.courseId,
        parsedParams.data.moduleId,
        parsedBody.data,
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

courseLessonsRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("course.create"),
  async (req, res, next) => {
    try {
      const parsedParams = lessonParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateCourseLessonRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateCourseLesson(
        parsedParams.data.courseId,
        parsedParams.data.moduleId,
        parsedParams.data.id,
        parsedBody.data,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT .../lessons/:id/media — attach/detach a lesson's media reference
 * (Phase 2 Unit 2.8). Permission `course.content.manage` per SYSTEM_PLAN.md
 * §16 — distinct from the `course.create` used for lesson authoring above.
 */
courseLessonsRoutes.put(
  "/:id/media",
  requireAuth,
  requirePermission("course.content.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = lessonParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = setLessonMediaRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await setCourseLessonMedia(
        parsedParams.data.courseId,
        parsedParams.data.moduleId,
        parsedParams.data.id,
        parsedBody.data.media_asset_id,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
