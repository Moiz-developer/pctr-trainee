import { Router } from "express";
import { z } from "zod";
import { listPoliciesQuerySchema } from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import { getPolicyDetail, listPolicies } from "./policies.service.js";

/**
 * Policy & Procedures — self-service half only (SYSTEM_PLAN.md
 * §14.8/§23/§26: `GET /policies/:slug`, "department/general access" — read
 * here means "any authenticated user," §14.8 defines no department-scoping
 * table for policies). `requireAuth` only, no permission middleware,
 * mirroring resources.routes.ts/user-courses.routes.ts exactly.
 */
export const policiesRoutes: Router = Router();

const slugParamsSchema = z.object({ slug: z.string().min(1) });

policiesRoutes.get("/", requireAuth, async (req, res, next) => {
  try {
    const parsedQuery = listPoliciesQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
    }
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const { items, meta } = await listPolicies(identity.id, parsedQuery.data);
    res.json({ data: items, meta });
  } catch (error) {
    next(error);
  }
});

policiesRoutes.get("/:slug", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = slugParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const result = await getPolicyDetail(identity.id, parsedParams.data.slug);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
