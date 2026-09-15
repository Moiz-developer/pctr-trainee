import { Router } from "express";
import { z } from "zod";
import { setPolicyDepartmentsRequestSchema } from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import { listPolicyDepartments, setPolicyDepartments } from "./policy-departments.service.js";

// mergeParams: true — mounted at /:policyId/departments under admin-policies.routes.ts.
export const policyDepartmentsRoutes: Router = Router({ mergeParams: true });

const policyParamsSchema = z.object({ policyId: z.string().min(1) });

/** Permission `department.manage` for both routes — mirrors resource-departments.routes.ts/announcement-departments.routes.ts exactly. */

policyDepartmentsRoutes.get(
  "/",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = policyParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await listPolicyDepartments(parsedParams.data.policyId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

policyDepartmentsRoutes.put(
  "/",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = policyParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = setPolicyDepartmentsRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await setPolicyDepartments(
        parsedParams.data.policyId,
        parsedBody.data.department_ids,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
