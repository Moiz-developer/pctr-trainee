import { Router } from "express";
import { z } from "zod";
import {
  createQueryRequestSchema,
  createQueryMessageRequestSchema,
  listQueriesQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createQuery,
  createQueryMessage,
  getQueryDetail,
  listUserQueries,
  listVisibleQueryCategories,
} from "./queries.service.js";

/**
 * Query/Support — self-service half only (SYSTEM_PLAN.md §14.7/§22/§26:
 * `POST /queries` "self"). `requireAuth` only, no permission middleware —
 * self-scoped entirely by the authenticated identity, the same shape
 * already established by `GET /dashboard` and `PATCH /progress/lessons/:id`.
 * Admin oversight (`GET /admin/queries`, `query.manage`) is a later unit.
 *
 * Phase 6.4 adds `GET /:id` (full thread) and `POST /:id/messages`
 * (follow-up reply) — same self-only shape, ownership enforced inside
 * queries.service.ts (404 vs 403 per §26/§31), not by any route-level filter.
 */
export const queriesRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

queriesRoutes.get("/", requireAuth, async (req, res, next) => {
  try {
    const parsedQuery = listQueriesQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }

    const { items, meta } = await listUserQueries(identity.id, parsedQuery.data);
    res.json({ data: items, meta });
  } catch (error) {
    next(error);
  }
});

queriesRoutes.post("/", requireAuth, async (req, res, next) => {
  try {
    const parsedBody = createQueryRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new ValidationError(parsedBody.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }

    const result = await createQuery(identity.id, parsedBody.data);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Registered before `/:id` — Express matches routes in registration order,
// and `:id` would otherwise swallow this literal single-segment path first
// (same reasoning admin-queries.routes.ts's own `/categories`/`/assignees`
// comment documents).
queriesRoutes.get("/categories", requireAuth, async (req, res, next) => {
  try {
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const categories = await listVisibleQueryCategories(identity.id);
    res.json({ data: categories });
  } catch (error) {
    next(error);
  }
});

queriesRoutes.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }

    const result = await getQueryDetail(identity.id, parsedParams.data.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

queriesRoutes.post("/:id/messages", requireAuth, async (req, res, next) => {
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

    const result = await createQueryMessage(identity.id, parsedParams.data.id, parsedBody.data);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});
