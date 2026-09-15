/**
 * Centralized error classes (SYSTEM_PLAN.md §31). All five named classes now
 * exist: AuthError/ForbiddenError were added by the authentication foundation
 * unit; ValidationError/NotFoundError/ConflictError are added here, justified
 * directly by this unit's admin-user endpoints (request-body validation,
 * :id lookups, duplicate email/employee_id).
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** 401 — missing/malformed/invalid/expired token, or a non-ACTIVE profile. */
export class AuthError extends AppError {
  constructor(message = "Authentication required.") {
    super(401, "UNAUTHENTICATED", message);
  }
}

/** 403 — authenticated, but lacking the required permission. */
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(403, "FORBIDDEN", message);
  }
}

/** 422 — request body/params failed validation. Carries per-field messages (§30). */
export class ValidationError extends AppError {
  constructor(fields: Record<string, string[]>, message = "Validation failed.") {
    super(422, "VALIDATION_ERROR", message, fields);
  }
}

/** 404 — the resource named by the URL does not exist. */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(404, "NOT_FOUND", message);
  }
}

/** 409 — the request conflicts with an existing resource (e.g. duplicate email). */
export class ConflictError extends AppError {
  constructor(message = "This resource already exists.") {
    super(409, "CONFLICT", message);
  }
}
