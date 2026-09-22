import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ApiClientError } from "../../../services/api/client";
import { getMediaAccessUrl, MEDIA_ACCESS_URL_STALE_MS } from "../../../services/api/media";
import { PreviewUnavailable } from "./PreviewUnavailable";
import { DocumentPage } from "./DocumentPage";

// Exported (download restriction unit) so callers outside course lessons —
// ResourcesPage.tsx/PoliciesPage.tsx — can detect a DOCX file themselves and
// choose to render this same in-app viewer, without duplicating the literal
// MIME string or changing this component itself.
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * In-app DOCUMENT viewer (Phase 2I). Only modern DOCX (OOXML — a zip of
 * XML) can be safely rendered client-side: `mammoth` converts it directly
 * to a small, known-safe subset of semantic HTML (headings, paragraphs,
 * lists, tables, bold/italic — no scripts, no event-handler attributes by
 * construction). Legacy binary `.doc` has no comparable safe client-side
 * parser available, so it deliberately falls back to an honest "not
 * supported" message rather than faking support — see this unit's
 * implementation report.
 *
 * The converted HTML is still run through DOMPurify before rendering:
 * mammoth's own output is safe by design, but sanitizing untrusted-content-
 * derived HTML before `dangerouslySetInnerHTML` is cheap, standard defense
 * in depth against a mammoth bug or a malformed/crafted file, not
 * optional.
 *
 * Bytes are fetched directly from the signed URL by the browser and
 * converted entirely client-side — never sent to any third-party service.
 */
export function DocumentLessonViewer({
  mediaAssetId,
  mimeType,
}: {
  mediaAssetId: string;
  mimeType: string | null;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(true);

  const accessUrlQuery = useQuery({
    queryKey: ["media-access-url", mediaAssetId],
    queryFn: () => getMediaAccessUrl(mediaAssetId),
    enabled: mimeType === DOCX_MIME,
    staleTime: MEDIA_ACCESS_URL_STALE_MS,
    refetchOnWindowFocus: false,
  });
  const signedUrl = accessUrlQuery.data?.url;

  useEffect(() => {
    if (!signedUrl) return;
    let cancelled = false;

    void (async () => {
      // Reset state for the new signed URL inside the async callback, not
      // synchronously at the top of the effect body — avoids
      // react-hooks/set-state-in-effect's cascading-render warning while
      // keeping the same observable timing.
      setIsConverting(true);
      setConvertError(null);
      setHtml(null);
      try {
        const [{ default: DOMPurify }, mammoth, fileResponse] = await Promise.all([
          import("dompurify"),
          import("mammoth"),
          fetch(signedUrl),
        ]);
        if (!fileResponse.ok) throw new Error("download failed");
        const arrayBuffer = await fileResponse.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (cancelled) return;
        setHtml(DOMPurify.sanitize(result.value));
      } catch {
        if (!cancelled) {
          setConvertError(
            "This document could not be displayed — the file may be corrupted or in an unsupported format.",
          );
        }
      } finally {
        if (!cancelled) setIsConverting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedUrl]);

  if (mimeType !== DOCX_MIME) {
    return (
      <PreviewUnavailable>
        This is a legacy .doc file. Only modern .docx documents can be viewed in the portal (no safe
        in-browser reader exists for the older binary format), and downloading is not available. Ask
        your administrator to provide this document as a PDF or .docx.
      </PreviewUnavailable>
    );
  }

  if (accessUrlQuery.isLoading || isConverting) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading document…
      </div>
    );
  }

  if (accessUrlQuery.isError) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-red-600">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {accessUrlQuery.error instanceof ApiClientError
          ? accessUrlQuery.error.message
          : "Couldn't load this document."}
        <button
          type="button"
          className="cursor-pointer font-medium underline"
          onClick={() => void accessUrlQuery.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (convertError) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-red-600">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {convertError}
      </div>
    );
  }

  return (
    <DocumentPage>
      <div className="rich-text" dangerouslySetInnerHTML={{ __html: html ?? "" }} />
    </DocumentPage>
  );
}
