/**
 * The authenticated identity attached to the request by requireAuth
 * (SYSTEM_PLAN.md §9: "attach req.user = { id, role, permissions,
 * departmentIds, status }"). Deliberately minimal — exactly the fields the
 * plan names, nothing else. Fuller profile fields are kept separately on
 * the same request so /auth/me can reuse its authentication lookup.
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

export interface RequestProfile {
  employeeId: string;
  fullName: string;
  email: string;
  phone: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      identity?: RequestIdentity;
      authProfile?: RequestProfile;
    }
  }
}
