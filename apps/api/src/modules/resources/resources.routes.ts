import { Router } from "express";
import { z } from "zod";
import { listResourcesQuerySchema } from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  getResourceDetail,
  listResources,
  listVisibleResourceCategories,
} from "./resources.service.js";

/**
 * Resource Library — self-service half only (SYSTEM_PLAN.md §14.5/§20/§26:
 * `GET /resources` "self"). `requireAuth` only, no permission middleware —
 * visibility is resolved entirely server-side by
 * `effectiveResourceVisibilityFilter` (authorization/access.service.ts),
 * never a client-supplied filter, mirroring user-courses.routes.ts exactly.
 *
 * `/categories` is registered before `/:id` — Express matches routes in
 * registration order, and `:id` would otherwise swallow that literal
 * single-segment path first (same gotcha admin-queries.routes.ts's own
 * `/categories`/`/assignees` comment documents).
 */
export const resourcesRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

resourcesRoutes.get("/categories", requireAuth, async (req, res, next) => {
  try {
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const categories = await listVisibleResourceCategories(identity.id);
    res.json({ data: categories });
  } catch (error) {
    next(error);
  }
});

resourcesRoutes.get("/", requireAuth, async (req, res, next) => {
  try {
    const parsedQuery = listResourcesQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }

    const { items, meta } = await listResources(identity.id, parsedQuery.data);
    res.json({ data: items, meta });
  } catch (error) {
    next(error);
  }
});

resourcesRoutes.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }

    const result = await getResourceDetail(identity.id, parsedParams.data.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
