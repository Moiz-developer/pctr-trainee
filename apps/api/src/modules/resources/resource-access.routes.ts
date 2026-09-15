import { Router } from "express";
import { z } from "zod";
import {
  grantResourceAccessRequestSchema,
  listResourceAccessQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  grantResourceAccess,
  listResourceAccess,
  revokeResourceAccess,
} from "./resource-access.service.js";

// mergeParams: true — mounted at /:resourceId/access under admin-resources.routes.ts.
export const resourceAccessRoutes: Router = Router({ mergeParams: true });

const resourceParamsSchema = z.object({ resourceId: z.string().min(1) });
const revokeParamsSchema = z.object({ resourceId: z.string().min(1), userId: z.string().min(1) });

/**
 * Consistent granular access control unit: explicit per-user Resource
 * access grants, mirroring course-access.routes.ts exactly. Permission
 * `resource.manage` — the one permission already gating the whole Resource
 * Library feature (no new permission created).
 */

resourceAccessRoutes.post(
  "/",
  requireAuth,
  requirePermission("resource.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = resourceParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = grantResourceAccessRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const { response, status } = await grantResourceAccess(
        parsedParams.data.resourceId,
        parsedBody.data,
        identity.id,
      );
      res.status(status).json({ data: response });
    } catch (error) {
      next(error);
    }
  },
);

resourceAccessRoutes.get(
  "/",
  requireAuth,
  requirePermission("resource.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = resourceParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedQuery = listResourceAccessQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listResourceAccess(
        parsedParams.data.resourceId,
        parsedQuery.data,
      );
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

resourceAccessRoutes.delete(
  "/:userId",
  requireAuth,
  requirePermission("resource.manage"),
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

      const result = await revokeResourceAccess(
        parsedParams.data.resourceId,
        parsedParams.data.userId,
        identity.id,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
