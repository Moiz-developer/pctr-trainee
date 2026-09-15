import { Router } from "express";
import { z } from "zod";
import { updateLessonProgressRequestSchema } from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import { getLessonProgress, upsertLessonProgress } from "./progress.service.js";

/**
 * Lesson Progress (SYSTEM_PLAN.md §26 `PATCH /progress/lessons/:id`, §18).
 * `requireAuth` only — no permission middleware: every authenticated,
 * ACTIVE user manages their OWN progress (§26: "self-only (own progress)"),
 * exactly the same "self" authorization shape already established by
 * `GET /auth/me` and `GET /courses` (user-courses.routes.ts) — scoped
 * entirely by the authenticated identity, never by a client-supplied id.
 */
export const progressRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

progressRoutes.get("/lessons/:id", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      // Unreachable in practice (requireAuth runs first), kept only to satisfy
      // strict typing on req.identity without an unsafe assertion.
      throw new Error("Missing authenticated identity.");
    }

    const result = await getLessonProgress(identity.id, parsedParams.data.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

progressRoutes.patch("/lessons/:id", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }
    const parsedBody = updateLessonProgressRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new ValidationError(parsedBody.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }

    const result = await upsertLessonProgress(identity.id, parsedParams.data.id, parsedBody.data);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
