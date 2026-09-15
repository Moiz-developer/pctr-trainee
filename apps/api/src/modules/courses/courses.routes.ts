import { Router } from "express";
import { z } from "zod";
import {
  createCourseRequestSchema,
  updateCourseRequestSchema,
  listCoursesQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  archiveCourse,
  createCourse,
  getCourse,
  getCourseProgressSummary,
  listCourses,
  updateCourse,
} from "./courses.service.js";
import { courseModulesRoutes } from "./course-modules.routes.js";
import { courseAccessRoutes } from "./course-access.routes.js";
import { courseDepartmentsRoutes } from "./course-departments.routes.js";
import { assessmentsRoutes } from "../assessments/assessments.routes.js";

export const coursesRoutes: Router = Router();

// Course Modules (SYSTEM_PLAN.md §14.2, Phase 2 Unit 2.3) are a sub-resource
// of courses — nested here rather than mounted separately in routes/index.ts.
coursesRoutes.use("/:courseId/modules", courseModulesRoutes);

// Course Access (SYSTEM_PLAN.md §14.2/§26, Phase 2 Unit 2.5) — explicit
// per-user grants, also a sub-resource of courses.
coursesRoutes.use("/:courseId/access", courseAccessRoutes);

// Course <-> Department assignment (new — Admin Course & Training Content
// Management unit; see course-departments.routes.ts).
coursesRoutes.use("/:courseId/departments", courseDepartmentsRoutes);

// Assessments (SYSTEM_PLAN.md §14.4/§19, Phase 4) — also a sub-resource of courses.
coursesRoutes.use("/:courseId/assessments", assessmentsRoutes);

const idParamsSchema = z.object({ id: z.string().min(1) });

/**
 * Permission mapping (SYSTEM_PLAN.md §5/§10, seeded codes `course.create`/
 * `course.view`/`course.delete` — no `course.update`/`course.manage` exists
 * in the seed, and this unit is explicitly told not to invent one unless
 * SYSTEM_PLAN.md requires it, which it doesn't by name): reads use
 * `course.view`; create and general field edits use `course.create` (the
 * only "author a course" permission available); archiving — a soft-delete
 * equivalent that never removes the row, per this unit's spec — uses
 * `course.delete`, the closest existing match for "remove from active use."
 */

coursesRoutes.get("/", requireAuth, requirePermission("course.view"), async (req, res, next) => {
  try {
    const parsedQuery = listCoursesQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
    }
    const { items, meta } = await listCourses(parsedQuery.data);
    res.json({ data: items, meta });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/courses/progress-summary (Admin Dashboard real data
 * unit) — registered BEFORE the `/:id` handler below: Express matches
 * single-segment routes by registration order, and `/:id` would otherwise
 * swallow this literal path as `id = "progress-summary"`. Same `course.view`
 * read permission as the list/detail routes above; no new permission.
 */
coursesRoutes.get(
  "/progress-summary",
  requireAuth,
  requirePermission("course.view"),
  async (_req, res, next) => {
    try {
      const { inProgressCount } = await getCourseProgressSummary();
      res.json({ data: { in_progress_count: inProgressCount } });
    } catch (error) {
      next(error);
    }
  },
);

coursesRoutes.get("/:id", requireAuth, requirePermission("course.view"), async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }
    const result = await getCourse(parsedParams.data.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

coursesRoutes.post("/", requireAuth, requirePermission("course.create"), async (req, res, next) => {
  try {
    const parsedBody = createCourseRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new ValidationError(parsedBody.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      // Unreachable in practice (requireAuth runs first), kept only to satisfy
      // strict typing on req.identity without an unsafe assertion.
      throw new Error("Missing authenticated identity.");
    }

    const result = await createCourse(parsedBody.data, identity.id);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

coursesRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("course.create"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateCourseRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateCourse(parsedParams.data.id, parsedBody.data);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

coursesRoutes.post(
  "/:id/archive",
  requireAuth,
  requirePermission("course.delete"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await archiveCourse(parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
