import { getSupabaseAdmin } from "../../lib/supabase-admin.js";

/**
 * Supabase Storage helpers (service-role, server-only). The service-role
 * client is the *only* thing that touches Storage (SYSTEM_PLAN.md §12/§16);
 * clients never hold Storage credentials. Nothing here returns the
 * service-role key or any long-lived credential — only time-boxed signed
 * URLs. Generalized over `bucket` (Phase 6.2) so the same helpers serve
 * both `course-media` and `query-attachments` — see media.service.ts's
 * purpose-to-bucket resolution.
 */

const readyBuckets = new Set<string>();

/**
 * Idempotently ensures a private bucket exists. Cached per-bucket after the
 * first success. Throws loudly if the bucket somehow exists but is public —
 * SYSTEM_PLAN.md §16 requires every media bucket to be private.
 *
 * (In a mature deployment bucket provisioning belongs in infrastructure
 * bootstrap, §40 Phase 0; doing it lazily here keeps the API self-healing
 * without a manual dashboard step.)
 */
export async function ensureBucket(bucket: string): Promise<void> {
  if (readyBuckets.has(bucket)) return;
  const supabase = getSupabaseAdmin();

  const { data } = await supabase.storage.getBucket(bucket);
  if (data) {
    if (data.public) {
      throw new Error(
        `Storage bucket "${bucket}" is public — SYSTEM_PLAN.md §16 requires media buckets to be private.`,
      );
    }
    readyBuckets.add(bucket);
    return;
  }

  const { error } = await supabase.storage.createBucket(bucket, { public: false });
  if (error && !/already exists|duplicate|resource already exists/i.test(error.message)) {
    throw error;
  }
  readyBuckets.add(bucket);
}

/** Signed *upload* URL for a server-computed path (SYSTEM_PLAN.md §16 step 3). */
export async function createSignedUploadUrl(bucket: string, storagePath: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath);
  if (error || !data) {
    throw error ?? new Error("Failed to create a signed upload URL.");
  }
  return data.signedUrl;
}

/** Real object metadata from Storage, or `null` if no object exists at that path (SYSTEM_PLAN.md §16 step 5 "verifies the object exists"). */
export async function getObjectInfo(
  bucket: string,
  storagePath: string,
): Promise<{ size: number; contentType: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).info(storagePath);
  if (error || !data) return null;
  return {
    size: Number(data.size ?? 0),
    contentType: data.contentType ?? "application/octet-stream",
  };
}

/** Short-lived signed *download* URL, or `null` if the object no longer exists (SYSTEM_PLAN.md §16 read flow step 3). */
export async function createSignedDownloadUrl(
  bucket: string,
  storagePath: string,
  ttlSeconds: number,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
