import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMediaAccessUrl, MEDIA_ACCESS_URL_STALE_MS } from "../../services/api/media";

/**
 * Renders a stored media image. Uses `src` when the list response already
 * carried a signed URL for it (batch-signed server-side, so a page of cards
 * needs no per-card request). Otherwise — or if that URL fails to load, e.g.
 * it expired while the list sat in the query cache — falls back to the
 * existing signed-URL flow (same `["media-access-url", id]` query the course
 * thumbnail and lesson viewers use). Shows `fallback` whenever there is no
 * image, the URL is still loading, or the fetch/load fails — a card should
 * never show a broken image.
 */
export function MediaImage({
  mediaAssetId,
  src,
  className,
  fallback,
}: {
  mediaAssetId: string | null;
  src?: string | null;
  className?: string;
  fallback: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const presignedUsable = !!mediaAssetId && !!src && failedSrc !== src;
  const query = useQuery({
    queryKey: ["media-access-url", mediaAssetId],
    queryFn: () => getMediaAccessUrl(mediaAssetId!),
    enabled: !!mediaAssetId && !presignedUsable,
    staleTime: MEDIA_ACCESS_URL_STALE_MS,
  });

  if (presignedUsable) {
    return <img src={src} alt="" className={className} onError={() => setFailedSrc(src)} />;
  }
  if (mediaAssetId && query.data && failedId !== mediaAssetId) {
    return (
      <img
        src={query.data.url}
        alt=""
        className={className}
        onError={() => setFailedId(mediaAssetId)}
      />
    );
  }
  return <>{fallback}</>;
}
