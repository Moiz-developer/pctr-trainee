/**
 * External video playback in the Trainer Portal (EXTERNAL_LINK lessons
 * only — uploaded-video lessons keep using VideoLessonPlayer.tsx,
 * unchanged). `getEmbeddableVideoUrl` recognizes YouTube/Vimeo URLs and
 * returns a fixed-shape, provider-controlled embed URL built entirely from
 * validated path/query fragments — the lesson's raw `external_url` is never
 * passed to the iframe `src` itself, so an arbitrary/malicious URL can never
 * reach an iframe (requirement: "do not trust arbitrary URLs as iframe
 * sources; only allow recognized providers/URL formats"). Any URL that
 * doesn't match a recognized provider/format returns `null`, and
 * CourseDetailPage.tsx falls back to the existing plain "Open Resource"
 * link — non-video external links are completely unaffected.
 */

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const VIMEO_ID_PATTERN = /^\d+$/;

function extractYouTubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  if (host === "youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }
    const match = url.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]+)/);
    const id = match?.[1] ?? null;
    return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  return null;
}

function extractVimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;

  const match = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/|$)/);
  const id = match?.[1] ?? null;
  return id && VIMEO_ID_PATTERN.test(id) ? id : null;
}

/**
 * Returns a safe, provider-hosted embed URL for a recognized YouTube/Vimeo
 * link, or `null` if the URL isn't from a recognized provider/format (any
 * parse failure, non-https scheme, or unmatched host/path fails closed to
 * `null` — never a best-effort guess).
 */
export function getEmbeddableVideoUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const youTubeId = extractYouTubeId(url);
  if (youTubeId) return `https://www.youtube-nocookie.com/embed/${youTubeId}`;

  const vimeoId = extractVimeoId(url);
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;

  return null;
}

/** Embedded iframe player for a recognized external video URL — reuses VideoLessonPlayer.tsx's `rounded-lg bg-black` framing convention. */
export function ExternalVideoPlayer({ embedUrl, title }: { embedUrl: string; title: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe
        src={embedUrl}
        title={title}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
