import { z } from "zod";

/**
 * A database-level identifier. Modeled as a UUID string throughout the
 * platform (see SYSTEM_PLAN.md §13, Database Architecture).
 */
export const idSchema = z.string();

/**
 * Externally-hosted content links (lesson/resource `external_url`) must be
 * HTTPS. A bare `z.url()` also accepts `javascript:` and `data:` URLs, which
 * would execute if ever rendered as an `href`/`window.open` target.
 */
export const httpsUrlSchema = z.url({ protocol: /^https$/ });
export type Id = z.infer<typeof idSchema>;

/**
 * An ISO-8601 timestamp string as returned by the API,
 * e.g. "2026-09-08T12:34:56.000Z".
 */
export const isoDateStringSchema = z.iso.datetime({ offset: true });
export type ISODateString = z.infer<typeof isoDateStringSchema>;

/**
 * Pagination metadata shape used by list endpoints (see SYSTEM_PLAN.md §26/§33).
 */
export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
