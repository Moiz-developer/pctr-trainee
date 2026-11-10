import { prisma } from "../../lib/prisma.js";
import { getMediaSettings } from "../settings/settings.service.js";
import { createSignedDownloadUrls } from "./media.storage.js";
import { COURSE_MEDIA_BUCKET, MAX_DEFAULT_SIGNED_URL_TTL_SECONDS } from "./media.constants.js";

/** The media_assets fields signing needs; select it through the owning row's relation. */
export const SIGNABLE_MEDIA_SELECT = {
  id: true,
  bucket: true,
  storagePath: true,
  mimeType: true,
} as const;

export interface SignableMediaAsset {
  id: string;
  bucket: string;
  storagePath: string;
  mimeType: string;
}

/**
 * Signed URLs for a page's course-media images (course thumbnails, module
 * covers, assessment covers) in one Storage request, so a list doesn't need
 * one `GET /media/:id/access-url` per card (each re-runs authentication and
 * several access lookups, and a page of them exhausts the DB pool).
 *
 * Callers pass the assets they already loaded through the owning row's
 * relation (`select: { image: { select: SIGNABLE_MEDIA_SELECT } }`), so no
 * separate media lookup is needed; `media_assets` RLS applied to that read.
 *
 * AUTHORIZATION IS THE CALLER'S JOB: pass only images the caller has already
 * established the user may view, with the same predicate getMediaAccessUrl
 * applies for that image type. This adds only the course-media bucket check.
 * Same capped default TTL as getMediaAccessUrl; only images are signed.
 * Anything not signed (video, a missing object, a Storage failure) is simply
 * absent from the map, and the client falls back to the per-media endpoint.
 */
export async function signCourseMediaAssets(
  assets: (SignableMediaAsset | null | undefined)[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const images = [
    ...new Map(
      assets
        .filter(
          (asset): asset is SignableMediaAsset =>
            !!asset && asset.bucket === COURSE_MEDIA_BUCKET && asset.mimeType.startsWith("image/"),
        )
        .map((asset) => [asset.id, asset]),
    ).values(),
  ];
  if (images.length === 0) return urls;
  try {
    const settings = await getMediaSettings();
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

/**
 * Same as signCourseMediaAssets, for callers that only have media ids: looks
 * the assets up first (one extra query). Use when that lookup can run
 * alongside other work, so it doesn't add a sequential step the way nesting
 * the asset into the owning row's query would.
 */
export async function signCourseMediaImages(
  mediaIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(mediaIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();
  try {
    const assets = await prisma.mediaAsset.findMany({
      where: { id: { in: ids } },
      select: SIGNABLE_MEDIA_SELECT,
    });
    return await signCourseMediaAssets(assets);
  } catch {
    return new Map();
  }
}

/** `urls.get(id) ?? null`, for building `*_url` response fields. */
export function signedUrlFor(urls: Map<string, string>, id: string | null): string | null {
  return id ? (urls.get(id) ?? null) : null;
}
