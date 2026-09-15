import { Router } from "express";
import { z } from "zod";
import {
  createQueryCategoryRequestSchema,
  updateQueryCategoryRequestSchema,
  listQueryCategoryRecordsQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createQueryCategory,
  getQueryCategory,
  listQueryCategories,
  updateQueryCategory,
} from "./query-categories.service.js";

export const queryCategoriesRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

/**
 * Permission `query.manage` for every route — the one permission the whole
 * Query/Support feature is gated by (mirrors resource-categories.routes.ts's
 * identical reasoning: categories are ticket-authoring metadata, gated the
 * same way ticket management itself is; read routes share the same
 * permission as write routes, no separate `*.view` code).
 */

queryCategoriesRoutes.get(
  "/",
  requireAuth,
  requirePermission("query.manage"),
  async (req, res, next) => {
    try {
      const parsedQuery = listQueryCategoryRecordsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listQueryCategories(parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

queryCategoriesRoutes.get(
  "/:id",
  requireAuth,
  requirePermission("query.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await getQueryCategory(parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

queryCategoriesRoutes.post(
  "/",
  requireAuth,
  requirePermission("query.manage"),
  async (req, res, next) => {
    try {
      const parsedBody = createQueryCategoryRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await createQueryCategory(parsedBody.data);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

queryCategoriesRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("query.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateQueryCategoryRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateQueryCategory(parsedParams.data.id, parsedBody.data);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
