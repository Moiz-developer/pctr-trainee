import { Router } from "express";
import { z } from "zod";
import { listCourseCatalogueQuerySchema } from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import { getUserCourseDetail, listUserCourses } from "./user-courses.service.js";

/**
 * User-facing course catalogue/detail (SYSTEM_PLAN.md §26 `GET /courses`,
 * `GET /courses/:id`). Deliberately a SEPARATE router/service pair from
 * courses.routes.ts/courses.service.ts (Admin management, permission-gated
 * — `course.view`/`course.create`/`course.delete`/`course.access.manage`)
 * so Admin and User authorization semantics can never be accidentally
 * mixed: this router uses only `requireAuth` — no permission middleware —
 * because every authenticated, ACTIVE user (any role) may browse their OWN
 * accessible catalogue; "accessible" is determined entirely server-side by
 * `canAccessCourse()` (authorization/access.service.ts), never by a
 * client-supplied filter.
 */
export const userCoursesRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

userCoursesRoutes.get("/", requireAuth, async (req, res, next) => {
  try {
    const parsedQuery = listCourseCatalogueQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      // Unreachable in practice (requireAuth runs first), kept only to satisfy
      // strict typing on req.identity without an unsafe assertion.
      throw new Error("Missing authenticated identity.");
    }

    const { items, meta } = await listUserCourses(identity.id, parsedQuery.data);
    res.json({ data: items, meta });
  } catch (error) {
    next(error);
  }
});

userCoursesRoutes.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }

    const result = await getUserCourseDetail(identity.id, parsedParams.data.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
