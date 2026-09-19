import { Router } from "express";
import { z } from "zod";
import {
  createPolicyRequestSchema,
  updatePolicyRequestSchema,
  createPolicyVersionRequestSchema,
  updatePolicyVersionRequestSchema,
  listAdminPoliciesQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  activatePolicyVersion,
  archivePolicyVersion,
  createPolicy,
  createPolicyVersion,
  getAdminPolicy,
  listAdminPolicies,
  updatePolicy,
  updatePolicyVersion,
} from "./admin-policies.service.js";
import { policyDepartmentsRoutes } from "./policy-departments.routes.js";
import { policyAccessRoutes } from "./policy-access.routes.js";

/**
 * Admin Policy & Procedures management (SYSTEM_PLAN.md §14.8/§23/§26,
 * Phase 5.2). Two deliberately separate permissions, per this phase's own
 * instruction: `policy.manage` gates every create/update action (policies,
 * versions, document attachment); the pre-existing `policy.version.activate`
 * gates ONLY the activate action. Read routes (list/detail) accept EITHER —
 * an activation-only reviewer still needs to browse what exists to decide
 * what to activate — via `requirePermission`'s array form (Phase 5.2 also
 * generalized that middleware to accept "any of these codes").
 */
export const adminPoliciesRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });
const policyVersionParamsSchema = z.object({
  policyId: z.string().min(1),
  versionId: z.string().min(1),
});
const policyIdParamsSchema = z.object({ policyId: z.string().min(1) });

const READ_PERMISSIONS = ["policy.manage", "policy.version.activate"];

adminPoliciesRoutes.use("/:policyId/departments", policyDepartmentsRoutes);
adminPoliciesRoutes.use("/:policyId/access", policyAccessRoutes);

adminPoliciesRoutes.get(
  "/",
  requireAuth,
  requirePermission(READ_PERMISSIONS),
  async (req, res, next) => {
    try {
      const parsedQuery = listAdminPoliciesQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listAdminPolicies(parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

adminPoliciesRoutes.get(
  "/:id",
  requireAuth,
  requirePermission(READ_PERMISSIONS),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await getAdminPolicy(parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminPoliciesRoutes.post(
  "/",
  requireAuth,
  requirePermission("policy.manage"),
  async (req, res, next) => {
    try {
      const parsedBody = createPolicyRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await createPolicy(parsedBody.data);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminPoliciesRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("policy.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updatePolicyRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updatePolicy(parsedParams.data.id, parsedBody.data);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminPoliciesRoutes.post(
  "/:policyId/versions",
  requireAuth,
  requirePermission("policy.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = policyIdParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = createPolicyVersionRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const result = await createPolicyVersion(
        identity.id,
        parsedParams.data.policyId,
        parsedBody.data,
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminPoliciesRoutes.patch(
  "/:policyId/versions/:versionId",
  requireAuth,
  requirePermission("policy.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = policyVersionParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updatePolicyVersionRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updatePolicyVersion(
        parsedParams.data.policyId,
        parsedParams.data.versionId,
        parsedBody.data,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminPoliciesRoutes.post(
  "/:policyId/versions/:versionId/activate",
  requireAuth,
  requirePermission("policy.version.activate"),
  async (req, res, next) => {
    try {
      const parsedParams = policyVersionParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await activatePolicyVersion(
        parsedParams.data.policyId,
        parsedParams.data.versionId,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminPoliciesRoutes.post(
  "/:policyId/versions/:versionId/archive",
  requireAuth,
  requirePermission("policy.version.activate"),
  async (req, res, next) => {
    try {
      const parsedParams = policyVersionParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await archivePolicyVersion(
        parsedParams.data.policyId,
        parsedParams.data.versionId,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
