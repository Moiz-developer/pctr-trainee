import { Router } from "express";
import { z } from "zod";
import {
  grantCourseAccessRequestSchema,
  listCourseAccessQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  grantCourseAccess,
  listCourseAccess,
  revokeCourseAccess,
} from "./course-access.service.js";

// mergeParams: true — mounted at /:courseId/access under courses.routes.ts.
export const courseAccessRoutes: Router = Router({ mergeParams: true });

// Strict UUID format validation (unlike the loose idSchema/z.string().min(1)
// convention used for route params elsewhere in this codebase) — this
// unit's own functional-verification requirements explicitly call for a 422
// on a malformed course/user id; see this unit's implementation report.
const courseParamsSchema = z.object({ courseId: z.uuid() });
const revokeParamsSchema = z.object({ courseId: z.uuid(), userId: z.uuid() });

/**
 * SYSTEM_PLAN.md §26: permission `course.access.manage` for grant, revoke,
 * and list — already seeded, described as exactly "Grant/revoke explicit
 * user-level course access." No new permission created.
 */

courseAccessRoutes.post(
  "/",
  requireAuth,
  requirePermission("course.access.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = courseParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = grantCourseAccessRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        // Unreachable in practice (requireAuth runs first), kept only to satisfy
        // strict typing on req.identity without an unsafe assertion.
        throw new Error("Missing authenticated identity.");
      }

      const { response, status } = await grantCourseAccess(
        parsedParams.data.courseId,
        parsedBody.data,
        identity.id,
      );
      res.status(status).json({ data: response });
    } catch (error) {
      next(error);
    }
  },
);

courseAccessRoutes.get(
  "/",
  requireAuth,
  requirePermission("course.access.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = courseParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedQuery = listCourseAccessQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listCourseAccess(parsedParams.data.courseId, parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * SYSTEM_PLAN.md §26's own route: `DELETE /admin/courses/:id/access/:userId`
 * — keyed by the target user's id, not an opaque access-record id (see this
 * unit's implementation report for why this is followed literally over the
 * task's own "conceptual" `:accessId` suggestion). Soft revoke — the
 * response body carries the updated (never deleted) record.
 */
courseAccessRoutes.delete(
  "/:userId",
  requireAuth,
  requirePermission("course.access.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = revokeParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const result = await revokeCourseAccess(
        parsedParams.data.courseId,
        parsedParams.data.userId,
        identity.id,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
