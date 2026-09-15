import { Router } from "express";
import { z } from "zod";
import {
  createResourceRequestSchema,
  updateResourceRequestSchema,
  listAdminResourcesQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createResource,
  getAdminResource,
  listAdminResources,
  updateResource,
} from "./admin-resources.service.js";
import { resourceDepartmentsRoutes } from "./resource-departments.routes.js";
import { resourceAccessRoutes } from "./resource-access.routes.js";

/**
 * Admin Resource Library management (SYSTEM_PLAN.md §14.5/§20/§26, Phase
 * 5.1). Every route here requires `resource.manage` — the one permission
 * this whole feature is gated by, matching the project-wide
 * "requirePermission(code), never requireRole(name)" rule (§5/§10).
 * `:resourceId/departments` is mounted before route registration order
 * matters (Express matches by registration order, but a nested sub-router
 * mount is unambiguous regardless — mirrors courses.routes.ts's identical
 * `/:courseId/departments` mount).
 */
export const adminResourcesRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

adminResourcesRoutes.use("/:resourceId/departments", resourceDepartmentsRoutes);
adminResourcesRoutes.use("/:resourceId/access", resourceAccessRoutes);

adminResourcesRoutes.get(
  "/",
  requireAuth,
  requirePermission("resource.manage"),
  async (req, res, next) => {
    try {
      const parsedQuery = listAdminResourcesQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listAdminResources(parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

adminResourcesRoutes.get(
  "/:id",
  requireAuth,
  requirePermission("resource.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await getAdminResource(parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminResourcesRoutes.post(
  "/",
  requireAuth,
  requirePermission("resource.manage"),
  async (req, res, next) => {
    try {
      const parsedBody = createResourceRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const result = await createResource(identity.id, parsedBody.data);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminResourcesRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("resource.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateResourceRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateResource(parsedParams.data.id, parsedBody.data);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
