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

const readyBuckets = new Map<string, string>();

/** Storage-level limits applied to a bucket (defence in depth; the API validates the same values). */
export interface BucketLimits {
  maxBytes: number;
  mimeAllowlist: ReadonlySet<string>;
}

function limitsSignature(limits: BucketLimits | undefined): string {
  return limits ? `${limits.maxBytes}|${[...limits.mimeAllowlist].sort().join(",")}` : "";
}

function isAlreadyExists(message: string): boolean {
  return /already exists|duplicate|resource already exists/i.test(message);
}

/**
 * Idempotently ensures a private bucket exists, with Storage-level
 * `file_size_limit`/`allowed_mime_types` matching the API's own validation,
 * so a direct PUT to a signed upload URL can't exceed them either. Cached per
 * bucket + limits after the first success, so limits changed in Admin
 * Settings are applied on the next upload. Throws loudly if the bucket
 * somehow exists but is public — SYSTEM_PLAN.md §16 requires every media
 * bucket to be private. Applying the limits is best-effort: a hosted
 * project's global upload cap can reject a larger per-bucket value, and that
 * must never block uploads the API has already validated.
 *
 * (In a mature deployment bucket provisioning belongs in infrastructure
 * bootstrap, §40 Phase 0; doing it lazily here keeps the API self-healing
 * without a manual dashboard step.)
 */
export async function ensureBucket(bucket: string, limits?: BucketLimits): Promise<void> {
  const signature = limitsSignature(limits);
  if (readyBuckets.get(bucket) === signature) return;
  const supabase = getSupabaseAdmin();
  const options = limits
    ? {
        public: false,
        fileSizeLimit: limits.maxBytes,
        allowedMimeTypes: [...limits.mimeAllowlist],
      }
    : { public: false };

  const { data } = await supabase.storage.getBucket(bucket);
  if (data) {
    if (data.public) {
      throw new Error(
        `Storage bucket "${bucket}" is public — SYSTEM_PLAN.md §16 requires media buckets to be private.`,
      );
    }
    if (limits) {
      const { error } = await supabase.storage.updateBucket(bucket, options);
      if (error) {
        console.error(`[api] could not apply Storage limits to bucket "${bucket}":`, error.message);
      }
    }
    readyBuckets.set(bucket, signature);
    return;
  }

  const { error } = await supabase.storage.createBucket(bucket, options);
  if (error && !isAlreadyExists(error.message)) {
    // The bucket itself must exist even if the limits couldn't be applied.
    const retry = await supabase.storage.createBucket(bucket, { public: false });
    if (retry.error && !isAlreadyExists(retry.error.message)) {
      throw retry.error;
    }
  }
  readyBuckets.set(bucket, signature);
}

/** Best-effort removal of an object the API rejected (size/type), so rejected files don't stay orphaned. */
export async function removeObject(bucket: string, storagePath: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  if (error) {
    console.error(
      `[api] could not remove rejected object "${bucket}/${storagePath}":`,
      error.message,
    );
  }
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

/**
 * The object's actual bytes (service-role, server-only) — used only where the file's content
 * itself must be read server-side (Document preview UI consistency unit: legacy `.doc` text
 * extraction), never handed to the browser directly. Everything the browser renders still goes
 * through a signed URL (createSignedDownloadUrl below); this never becomes a response body.
 */
export async function downloadObject(bucket: string, storagePath: string): Promise<Buffer | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
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
