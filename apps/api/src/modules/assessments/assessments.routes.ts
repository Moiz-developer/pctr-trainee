import { Router } from "express";
import { z } from "zod";
import {
  createAssessmentRequestSchema,
  updateAssessmentRequestSchema,
  listAssessmentsQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createAssessment,
  getAssessment,
  listAssessments,
  updateAssessment,
} from "./assessments.service.js";
import { assessmentQuestionsRoutes } from "./assessment-questions.routes.js";
import { adminAssessmentAttemptsRoutes } from "./assessment-grading.routes.js";

// mergeParams: true — mounted at /:courseId/assessments under
// courses.routes.ts, mirroring course-modules/course-lessons.
export const assessmentsRoutes: Router = Router({ mergeParams: true });

// Assessment Questions (SYSTEM_PLAN.md §14.4) — a sub-resource of assessments.
assessmentsRoutes.use("/:assessmentId/questions", assessmentQuestionsRoutes);

// Admin grading/oversight of attempts (SYSTEM_PLAN.md §19, §Open Questions #5) — also a sub-resource of assessments.
assessmentsRoutes.use("/:assessmentId/attempts", adminAssessmentAttemptsRoutes);

const courseIdParamsSchema = z.object({ courseId: z.string().min(1) });
const paramsSchema = courseIdParamsSchema.extend({ id: z.string().min(1) });

/** All routes here require `assessment.manage` — see apps/api/src/db/seed.ts's doc comment for why this permission exists. */

assessmentsRoutes.get(
  "/",
  requireAuth,
  requirePermission("assessment.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = courseIdParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedQuery = listAssessmentsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listAssessments(parsedParams.data.courseId, parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

assessmentsRoutes.get(
  "/:id",
  requireAuth,
  requirePermission("assessment.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = paramsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await getAssessment(parsedParams.data.courseId, parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

assessmentsRoutes.post(
  "/",
  requireAuth,
  requirePermission("assessment.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = courseIdParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = createAssessmentRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const result = await createAssessment(
        parsedParams.data.courseId,
        parsedBody.data,
        identity.id,
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

assessmentsRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("assessment.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = paramsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateAssessmentRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateAssessment(
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
