import { Router } from "express";
import { z } from "zod";
import {
  createDepartmentRequestSchema,
  updateDepartmentRequestSchema,
  listDepartmentsQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
} from "./departments.service.js";

export const departmentsRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

/**
 * All department admin routes require `department.manage` (SYSTEM_PLAN.md
 * §26 — the only department-related permission the plan defines). Read
 * routes are gated by the same permission as write routes: the plan defines
 * no separate `department.view`-style permission, and inventing one is
 * exactly what this unit's task explicitly forbids.
 */
departmentsRoutes.get(
  "/",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedQuery = listDepartmentsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listDepartments(parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

departmentsRoutes.get(
  "/:id",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await getDepartment(parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

departmentsRoutes.post(
  "/",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedBody = createDepartmentRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await createDepartment(parsedBody.data);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

departmentsRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("department.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateDepartmentRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateDepartment(parsedParams.data.id, parsedBody.data);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
