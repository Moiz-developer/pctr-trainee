import { Router } from "express";
import { z } from "zod";
import {
  createQueryMessageRequestSchema,
  listAdminQueriesQuerySchema,
  updateAdminQueryRequestSchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createAdminQueryMessage,
  getAdminQueryDetail,
  listAdminQueries,
  listQueryCategories,
  listQueryManagers,
  updateAdminQuery,
} from "./admin-queries.service.js";

/**
 * Admin Query Queue + Management (SYSTEM_PLAN.md §14.7/§22/§26, Phase
 * 6.6/6.7). Every route here requires `query.manage` — the one permission
 * code the plan itself names for query oversight (§26: `GET /admin/queries
 * | query.manage`). No hard-coded SUPPORT role: authorization is this
 * permission code alone, matching the project-wide "requirePermission(code),
 * never requireRole(name)" rule (§5/§10) — any role a future migration
 * grants `query.manage` to gets this queue and its management actions,
 * with no code change here.
 *
 * `/categories` and `/assignees` are registered before `/:id` — Express
 * matches routes in registration order, and `:id` would otherwise swallow
 * those literal single-segment paths first.
 */
export const adminQueriesRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

adminQueriesRoutes.get(
  "/",
  requireAuth,
  requirePermission("query.manage"),
  async (req, res, next) => {
    try {
      const parsedQuery = listAdminQueriesQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listAdminQueries(parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

adminQueriesRoutes.get(
  "/categories",
  requireAuth,
  requirePermission("query.manage"),
  async (_req, res, next) => {
    try {
      const categories = await listQueryCategories();
      res.json({ data: categories });
    } catch (error) {
      next(error);
    }
  },
);

adminQueriesRoutes.get(
  "/assignees",
  requireAuth,
  requirePermission("query.manage"),
  async (_req, res, next) => {
    try {
      const managers = await listQueryManagers();
      res.json({ data: managers });
    } catch (error) {
      next(error);
    }
  },
);

adminQueriesRoutes.get(
  "/:id",
  requireAuth,
  requirePermission("query.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await getAdminQueryDetail(parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminQueriesRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("query.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateAdminQueryRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const result = await updateAdminQuery(
        parsedParams.data.id,
        parsedBody.data,
        identity.id,
        req.ip ?? null,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminQueriesRoutes.post(
  "/:id/messages",
  requireAuth,
  requirePermission("query.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = createQueryMessageRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const result = await createAdminQueryMessage(
        identity.id,
        parsedParams.data.id,
        parsedBody.data,
        req.ip ?? null,
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
