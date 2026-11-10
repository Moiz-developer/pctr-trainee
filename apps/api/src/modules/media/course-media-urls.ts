import { prisma } from "../../lib/prisma.js";
import { getMediaSettings } from "../settings/settings.service.js";
import { createSignedDownloadUrls } from "./media.storage.js";
import { COURSE_MEDIA_BUCKET, MAX_DEFAULT_SIGNED_URL_TTL_SECONDS } from "./media.constants.js";

/**
 * Signed URLs for a page's course-media images (course thumbnails, module
 * covers, assessment covers) in one Storage request, so a list doesn't need
 * one `GET /media/:id/access-url` per card (each re-runs authentication and
 * several access lookups, and a page of them exhausts the DB pool).
 *
 * AUTHORIZATION IS THE CALLER'S JOB: pass only ids of images the caller has
 * already established the user may view, with the same predicate
 * getMediaAccessUrl applies for that image type. This helper adds only the
 * course-media bucket check (and `media_assets` RLS still applies). Same
 * capped default TTL as getMediaAccessUrl; only images are signed. Anything
 * not signed (video, a missing object, a Storage failure) is simply absent
 * from the map, and the client falls back to the per-media endpoint.
 */
export async function signCourseMediaImages(
  mediaIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(mediaIds.filter((id): id is string => !!id))];
  const urls = new Map<string, string>();
  if (ids.length === 0) return urls;
  try {
    const [assets, settings] = await Promise.all([
      prisma.mediaAsset.findMany({
        where: { id: { in: ids }, bucket: COURSE_MEDIA_BUCKET },
        select: { id: true, storagePath: true, mimeType: true },
      }),
      getMediaSettings(),
    ]);
    const images = assets.filter((asset) => asset.mimeType.startsWith("image/"));
    const ttl = Math.min(settings.signedUrlTtlDefaultSeconds, MAX_DEFAULT_SIGNED_URL_TTL_SECONDS);
    const byPath = await createSignedDownloadUrls(
      COURSE_MEDIA_BUCKET,
      images.map((asset) => asset.storagePath),
      ttl,
    );
    for (const asset of images) {
      const url = byPath.get(asset.storagePath);
      if (url) urls.set(asset.id, url);
    }
  } catch {
    // Best effort: the page itself must not fail because of images.
    urls.clear();
  }
  return urls;
}

/** `urls.get(id) ?? null`, for building `*_url` response fields. */
export function signedUrlFor(urls: Map<string, string>, id: string | null): string | null {
  return id ? (urls.get(id) ?? null) : null;
}
