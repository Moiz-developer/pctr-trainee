import { Router } from "express";
import { z } from "zod";
import {
  createResourceCategoryRequestSchema,
  updateResourceCategoryRequestSchema,
  listResourceCategoriesQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createResourceCategory,
  getResourceCategory,
  listResourceCategories,
  updateResourceCategory,
} from "./resource-categories.service.js";

export const resourceCategoriesRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

/**
 * Permission `resource.manage` for every route — the one permission the
 * whole Resources feature is gated by (mirrors course-categories.routes.ts's
 * identical reasoning: categories are resource-authoring metadata, gated
 * the same way resources themselves are; read routes share the same
 * permission as write routes, no separate `*.view` code).
 */

resourceCategoriesRoutes.get(
  "/",
  requireAuth,
  requirePermission("resource.manage"),
  async (req, res, next) => {
    try {
      const parsedQuery = listResourceCategoriesQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listResourceCategories(parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

resourceCategoriesRoutes.get(
  "/:id",
  requireAuth,
  requirePermission("resource.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await getResourceCategory(parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

resourceCategoriesRoutes.post(
  "/",
  requireAuth,
  requirePermission("resource.manage"),
  async (req, res, next) => {
    try {
      const parsedBody = createResourceCategoryRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await createResourceCategory(parsedBody.data);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

resourceCategoriesRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("resource.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateResourceCategoryRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateResourceCategory(parsedParams.data.id, parsedBody.data);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
