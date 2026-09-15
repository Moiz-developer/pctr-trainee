import { Router } from "express";
import { z } from "zod";
import {
  gradeAssessmentAttemptRequestSchema,
  listAdminAssessmentAttemptsQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import { gradeAssessmentAttempt, listAttemptsForGrading } from "./assessment-grading.service.js";

// mergeParams: true — mounted at /:assessmentId/attempts under
// assessments.routes.ts, so req.params carries courseId + assessmentId here.
export const adminAssessmentAttemptsRoutes: Router = Router({ mergeParams: true });

const hierarchyParamsSchema = z.object({
  courseId: z.string().min(1),
  assessmentId: z.string().min(1),
});
const attemptParamsSchema = hierarchyParamsSchema.extend({ id: z.string().min(1) });

/**
 * Admin oversight/grading of attempts (SYSTEM_PLAN.md §Open Questions #5).
 * Listing uses either admin permission; grading is `assessment.grade`
 * specifically (the one permission code the plan itself names for this).
 */

adminAssessmentAttemptsRoutes.get(
  "/",
  requireAuth,
  requirePermission("assessment.grade"),
  async (req, res, next) => {
    try {
      const parsedParams = hierarchyParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedQuery = listAdminAssessmentAttemptsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listAttemptsForGrading(
        parsedParams.data.courseId,
        parsedParams.data.assessmentId,
        parsedQuery.data,
      );
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

adminAssessmentAttemptsRoutes.post(
  "/:id/grade",
  requireAuth,
  requirePermission("assessment.grade"),
  async (req, res, next) => {
    try {
      const parsedParams = attemptParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = gradeAssessmentAttemptRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const result = await gradeAssessmentAttempt(
        parsedParams.data.courseId,
        parsedParams.data.assessmentId,
        parsedParams.data.id,
        identity.id,
        parsedBody.data,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
