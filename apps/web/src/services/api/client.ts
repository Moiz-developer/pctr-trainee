import { apiErrorSchema } from "@internal-training/shared";
import { env } from "../../config/env";
import { supabase } from "../supabase/client";

/**
 * Normalized client-side error for a failed API call (SYSTEM_PLAN.md §27
 * services/api "error normalization"). Carries the server's error code/
 * message/fields when the response matched the platform's error envelope
 * (§26/§31); falls back to a generic message otherwise.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/**
 * Thin fetch wrapper (SYSTEM_PLAN.md §27 services/api "fetch wrapper,
 * interceptors, error normalization"): attaches the current Supabase access
 * token as `Authorization: Bearer <token>` (§9), prefixes every call with
 * `/api/v1` (§26), and parses the platform's `{ error }` envelope into
 * `ApiClientError` on failure.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (session) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${env.VITE_API_BASE_URL}/api/v1${path}`, {
    ...init,
    headers,
  });

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(body);
    if (parsedError.success) {
      const { code, message, fields } = parsedError.data.error;
      throw new ApiClientError(response.status, code, message, fields);
    }
    throw new ApiClientError(response.status, "UNKNOWN_ERROR", "Something went wrong.");
  }

  return body as T;
}
