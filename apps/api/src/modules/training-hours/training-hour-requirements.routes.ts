import { Router } from "express";
import {
  createTrainingHourRequirementRequestSchema,
  listTrainingHourRequirementsQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createTrainingHourRequirement,
  listTrainingHourRequirements,
} from "./training-hour-requirements.service.js";

/**
 * Admin config for `training_hour_requirements` (SYSTEM_PLAN.md §14.3).
 * `training.manage` is not a permission code named anywhere in
 * SYSTEM_PLAN.md's own text (no permission catalogue entry exists for this
 * table) — added following this project's own established convention of one
 * permission per admin-write table (department.manage, course.access.manage,
 * ...); see apps/api/src/db/seed.ts's doc comment for this permission.
 */
export const trainingHourRequirementsRoutes: Router = Router();

trainingHourRequirementsRoutes.get(
  "/",
  requireAuth,
  requirePermission("training.manage"),
  async (req, res, next) => {
    try {
      const parsedQuery = listTrainingHourRequirementsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listTrainingHourRequirements(parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

trainingHourRequirementsRoutes.post(
  "/",
  requireAuth,
  requirePermission("training.manage"),
  async (req, res, next) => {
    try {
      const parsedBody = createTrainingHourRequirementRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const result = await createTrainingHourRequirement(parsedBody.data, identity.id);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
