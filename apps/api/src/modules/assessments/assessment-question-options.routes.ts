import { Router } from "express";
import { z } from "zod";
import {
  createAssessmentQuestionOptionRequestSchema,
  updateAssessmentQuestionOptionRequestSchema,
  listAssessmentQuestionOptionsQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createAssessmentQuestionOption,
  listAssessmentQuestionOptions,
  updateAssessmentQuestionOption,
} from "./assessment-question-options.service.js";

// mergeParams: true — mounted at /:questionId/options under
// assessment-questions.routes.ts, so req.params carries courseId +
// assessmentId + questionId here.
export const assessmentQuestionOptionsRoutes: Router = Router({ mergeParams: true });

const hierarchyParamsSchema = z.object({
  courseId: z.string().min(1),
  assessmentId: z.string().min(1),
  questionId: z.string().min(1),
});
const optionParamsSchema = hierarchyParamsSchema.extend({ id: z.string().min(1) });

assessmentQuestionOptionsRoutes.get(
  "/",
  requireAuth,
  requirePermission("assessment.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = hierarchyParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedQuery = listAssessmentQuestionOptionsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listAssessmentQuestionOptions(
        parsedParams.data.courseId,
        parsedParams.data.assessmentId,
        parsedParams.data.questionId,
        parsedQuery.data,
      );
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

assessmentQuestionOptionsRoutes.post(
  "/",
  requireAuth,
  requirePermission("assessment.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = hierarchyParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = createAssessmentQuestionOptionRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await createAssessmentQuestionOption(
        parsedParams.data.courseId,
        parsedParams.data.assessmentId,
        parsedParams.data.questionId,
        parsedBody.data,
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

assessmentQuestionOptionsRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("assessment.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = optionParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateAssessmentQuestionOptionRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateAssessmentQuestionOption(
        parsedParams.data.courseId,
        parsedParams.data.assessmentId,
        parsedParams.data.questionId,
        parsedParams.data.id,
        parsedBody.data,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
