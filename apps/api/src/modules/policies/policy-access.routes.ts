import { Router } from "express";
import { z } from "zod";
import {
  grantPolicyAccessRequestSchema,
  listPolicyAccessQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  grantPolicyAccess,
  listPolicyAccess,
  revokePolicyAccess,
} from "./policy-access.service.js";

// mergeParams: true — mounted at /:policyId/access under admin-policies.routes.ts.
export const policyAccessRoutes: Router = Router({ mergeParams: true });

const policyParamsSchema = z.object({ policyId: z.string().min(1) });
const revokeParamsSchema = z.object({ policyId: z.string().min(1), userId: z.string().min(1) });

/**
 * Explicit per-user Policy access grants, mirroring resource-access.routes.ts
 * exactly. Permission `policy.manage` — the one permission already gating all
 * Policy administration (no new permission created).
 */

policyAccessRoutes.post(
  "/",
  requireAuth,
  requirePermission("policy.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = policyParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = grantPolicyAccessRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const { response, status } = await grantPolicyAccess(
        parsedParams.data.policyId,
        parsedBody.data,
        identity.id,
      );
      res.status(status).json({ data: response });
    } catch (error) {
      next(error);
    }
  },
);

policyAccessRoutes.get(
  "/",
  requireAuth,
  requirePermission("policy.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = policyParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedQuery = listPolicyAccessQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listPolicyAccess(parsedParams.data.policyId, parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

policyAccessRoutes.delete(
  "/:userId",
  requireAuth,
  requirePermission("policy.manage"),
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

      const result = await revokePolicyAccess(
        parsedParams.data.policyId,
        parsedParams.data.userId,
        identity.id,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
