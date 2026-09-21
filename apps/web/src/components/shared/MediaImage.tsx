import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMediaAccessUrl, MEDIA_ACCESS_URL_STALE_MS } from "../../services/api/media";

/**
 * Renders a stored media image through the existing signed-URL flow (same
 * `["media-access-url", id]` query the course thumbnail and lesson viewers
 * use). Shows `fallback` whenever there is no image, the URL is still loading,
 * or the fetch/load fails — a card should never show a broken image.
 */
export function MediaImage({
  mediaAssetId,
  className,
  fallback,
}: {
  mediaAssetId: string | null;
  className?: string;
  fallback: ReactNode;
}) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["media-access-url", mediaAssetId],
    queryFn: () => getMediaAccessUrl(mediaAssetId!),
    enabled: !!mediaAssetId,
    staleTime: MEDIA_ACCESS_URL_STALE_MS,
  });

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
