import { Router } from "express";
import { z } from "zod";
import { submitAssessmentAttemptRequestSchema } from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  getAssessmentDetail,
  getOwnAttempt,
  listOwnAssessmentHistory,
  listOwnAssessments,
  listOwnAttempts,
  startAssessmentAttempt,
  submitAssessmentAttempt,
} from "./assessment-attempts.service.js";

/**
 * Trainee-facing Assessment Engine routes (SYSTEM_PLAN.md §26: `POST
 * /assessments/:id/attempts`, `POST /assessments/attempts/:id/submit` — the
 * two literally-named endpoints, mounted flat under /assessments exactly as
 * given, not nested under /courses like the admin CRUD routes). `requireAuth`
 * only — every handler is either self-scoped by the authenticated identity
 * (attempts) or gated by `requireCourseAccess`-equivalent logic inside the
 * service (loadAuthorizedAssessment), matching the same shape as
 * progress.routes.ts.
 */
export const assessmentAttemptsRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

/**
 * GET /api/v1/assessments (Assessments unit) — this caller's own PUBLISHED
 * assessments across every course they have effective access to. Auth-only,
 * same shape as every other route in this router: authorization is the
 * caller's own effective course access (`effectiveCourseAccessFilter`
 * inside `listOwnAssessments`), not a permission code — mirrors `GET
 * /courses` (userCoursesRoutes) exactly.
 */
assessmentAttemptsRoutes.get("/", requireAuth, async (req, res, next) => {
  try {
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const { items, meta } = await listOwnAssessments(identity.id);
    res.json({ data: items, meta });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/assessments/history — this caller's own completed attempts across
 * every assessment they can access. Registered BEFORE `GET /:id` so "history"
 * is never captured as an assessment id. Self-scoped, same auth-only shape as
 * `GET /` above.
 */
assessmentAttemptsRoutes.get("/history", requireAuth, async (req, res, next) => {
  try {
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const { items, meta } = await listOwnAssessmentHistory(identity.id);
    res.json({ data: items, meta });
  } catch (error) {
    next(error);
  }
});

assessmentAttemptsRoutes.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const result = await getAssessmentDetail(identity.id, parsedParams.data.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

assessmentAttemptsRoutes.get("/:id/attempts", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const { items, meta } = await listOwnAttempts(identity.id, parsedParams.data.id);
    res.json({ data: items, meta });
  } catch (error) {
    next(error);
  }
});

assessmentAttemptsRoutes.post("/:id/attempts", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const result = await startAssessmentAttempt(identity.id, parsedParams.data.id);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

assessmentAttemptsRoutes.get("/attempts/:id", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const result = await getOwnAttempt(identity.id, parsedParams.data.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

assessmentAttemptsRoutes.post("/attempts/:id/submit", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }
    const parsedBody = submitAssessmentAttemptRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new ValidationError(parsedBody.error.flatten().fieldErrors);
    }
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const result = await submitAssessmentAttempt(
      identity.id,
      parsedParams.data.id,
      parsedBody.data,
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
