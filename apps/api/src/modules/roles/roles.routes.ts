import { Router } from "express";
import { z } from "zod";
import {
  createRoleRequestSchema,
  updateRoleRequestSchema,
  setRolePermissionsRequestSchema,
  listRolesQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  createRole,
  getRole,
  listAllPermissions,
  listRoles,
  setRolePermissions,
  updateRole,
} from "./roles.service.js";

/**
 * Admin Role & Permission Management (SYSTEM_PLAN.md §5/§10). Every route
 * requires the new `role.manage` permission (apps/api/src/db/seed.ts) — the
 * one permission this whole feature is gated by, matching every other
 * admin-managed-lookup-table module's single-permission-gate convention
 * (resource.manage, query.manage, policy.manage, ...).
 *
 * `/permissions` (the read-only catalogue) is registered on this same
 * router rather than a separate one, mirroring admin-queries.routes.ts's
 * own `/categories`/`/assignees` sub-resources registered ahead of `/:id` —
 * same reasoning: Express matches by registration order, and `:id` would
 * otherwise swallow a literal `permissions` segment mounted after it if
 * this were nested under /admin/roles instead of mounted separately (see
 * routes/index.ts: this router is mounted at /admin/roles, and a sibling
 * export below is mounted at /admin/permissions).
 */
export const rolesRoutes: Router = Router();
export const permissionsRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

rolesRoutes.get("/", requireAuth, requirePermission("role.manage"), async (req, res, next) => {
  try {
    const parsedQuery = listRolesQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
    }
    const { items, meta } = await listRoles(parsedQuery.data);
    res.json({ data: items, meta });
  } catch (error) {
    next(error);
  }
});

rolesRoutes.get("/:id", requireAuth, requirePermission("role.manage"), async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }
    const result = await getRole(parsedParams.data.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

rolesRoutes.post("/", requireAuth, requirePermission("role.manage"), async (req, res, next) => {
  try {
    const parsedBody = createRoleRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new ValidationError(parsedBody.error.flatten().fieldErrors);
    }
    const result = await createRole(parsedBody.data);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

rolesRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("role.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateRoleRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateRole(parsedParams.data.id, parsedBody.data);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

rolesRoutes.put(
  "/:id/permissions",
  requireAuth,
  requirePermission("role.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = setRolePermissionsRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await setRolePermissions(
        parsedParams.data.id,
        parsedBody.data.permission_ids,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

permissionsRoutes.get(
  "/",
  requireAuth,
  requirePermission("role.manage"),
  async (_req, res, next) => {
    try {
      const permissions = await listAllPermissions();
      res.json({ data: permissions });
    } catch (error) {
      next(error);
    }
  },
);
