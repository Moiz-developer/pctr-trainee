/**
 * The authenticated identity attached to the request by requireAuth
 * (SYSTEM_PLAN.md §9: "attach req.user = { id, role, permissions,
 * departmentIds, status }"). Deliberately minimal — exactly the fields the
 * plan names, nothing else. Endpoints needing fuller profile fields
 * (employeeId, fullName, email, phone) query for them separately — see
 * auth.routes.ts's GET /auth/me.
 */
export interface RequestIdentity {
  id: string;
  role: {
    id: string;
    code: string;
    name: string;
  };
  permissions: string[];
  departmentIds: string[];
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      identity?: RequestIdentity;
    }
  }
}
