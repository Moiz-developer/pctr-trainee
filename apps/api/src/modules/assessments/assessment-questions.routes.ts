import { Router } from "express";
import { z } from "zod";
import {
  createAssessmentQuestionRequestSchema,
  updateAssessmentQuestionRequestSchema,
  listAssessmentQuestionsQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createAssessmentQuestion,
  getAssessmentQuestion,
  listAssessmentQuestions,
  updateAssessmentQuestion,
} from "./assessment-questions.service.js";
import { assessmentQuestionOptionsRoutes } from "./assessment-question-options.routes.js";

// mergeParams: true — mounted at /:assessmentId/questions under
// assessments.routes.ts, itself mounted at /:courseId/assessments under
// courses.routes.ts, so req.params carries courseId + assessmentId here.
export const assessmentQuestionsRoutes: Router = Router({ mergeParams: true });

// Options are a sub-resource of questions (SYSTEM_PLAN.md §14.4) — "questionId"
// (not "id") so it doesn't collide with this router's own "/:id" routes below.
assessmentQuestionsRoutes.use("/:questionId/options", assessmentQuestionOptionsRoutes);

const hierarchyParamsSchema = z.object({
  courseId: z.string().min(1),
  assessmentId: z.string().min(1),
});
const questionParamsSchema = hierarchyParamsSchema.extend({ id: z.string().min(1) });

assessmentQuestionsRoutes.get(
  "/",
  requireAuth,
  requirePermission("assessment.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = hierarchyParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedQuery = listAssessmentQuestionsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listAssessmentQuestions(
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

assessmentQuestionsRoutes.get(
  "/:id",
  requireAuth,
  requirePermission("assessment.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = questionParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await getAssessmentQuestion(
        parsedParams.data.courseId,
        parsedParams.data.assessmentId,
        parsedParams.data.id,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

assessmentQuestionsRoutes.post(
  "/",
  requireAuth,
  requirePermission("assessment.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = hierarchyParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = createAssessmentQuestionRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await createAssessmentQuestion(
        parsedParams.data.courseId,
        parsedParams.data.assessmentId,
        parsedBody.data,
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

assessmentQuestionsRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("assessment.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = questionParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateAssessmentQuestionRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateAssessmentQuestion(
        parsedParams.data.courseId,
        parsedParams.data.assessmentId,
        parsedParams.data.id,
        parsedBody.data,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
