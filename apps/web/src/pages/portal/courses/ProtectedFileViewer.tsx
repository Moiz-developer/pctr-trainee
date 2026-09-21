import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ApiClientError } from "../../../services/api/client";
import { getMediaAccessUrl, MEDIA_ACCESS_URL_STALE_MS } from "../../../services/api/media";
import { PdfLessonViewer } from "./PdfLessonViewer";
import type { PdfViewerSizingProps } from "./pdfModalSizing";
import { DocumentLessonViewer, DOCX_MIME } from "./DocumentLessonViewer";
import { PreviewUnavailable } from "./PreviewUnavailable";

const PDF_MIME = "application/pdf";

/** Image asset shown inside the portal (no "open in new tab"/download link). */
function ProtectedImage({ mediaAssetId }: { mediaAssetId: string }) {
  const accessUrlQuery = useQuery({
    queryKey: ["media-access-url", mediaAssetId],
    queryFn: () => getMediaAccessUrl(mediaAssetId),
    staleTime: MEDIA_ACCESS_URL_STALE_MS,
    refetchOnWindowFocus: false,
  });

  if (accessUrlQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading image…
      </div>
    );
  }
  if (accessUrlQuery.isError || !accessUrlQuery.data) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-red-600">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {accessUrlQuery.error instanceof ApiClientError
          ? accessUrlQuery.error.message
          : "Couldn't load this image."}
      </div>
    );
  }
  return (
    <div className="protected-content" onContextMenu={(event) => event.preventDefault()}>
      <img
        src={accessUrlQuery.data.url}
        alt=""
        draggable={false}
        className="mx-auto max-h-[70vh] max-w-full rounded-lg"
      />
    </div>
  );
}

/**
 * Views a protected media asset inside the portal, picking a viewer from its
 * MIME type: PDF (pdf.js canvas), DOCX (rendered HTML) or an image. Anything
 * else is reported as not previewable — never opened as a raw Storage URL, so
 * there is no normal download path. Pass `mimeType` when the caller already
 * knows it; otherwise it comes from the authorized access-url response (the
 * same authorization check as any other media access).
 */
export function ProtectedFileViewer({
  mediaAssetId,
  mimeType,
  pdfProps,
}: {
  mediaAssetId: string;
  mimeType?: string | null;
  /** Opt-in for a host modal: lets a PDF size the modal to its page (see pdfModalSizing.ts). */
  pdfProps?: PdfViewerSizingProps;
}) {
  const accessUrlQuery = useQuery({
    queryKey: ["media-access-url", mediaAssetId],
    queryFn: () => getMediaAccessUrl(mediaAssetId),
    enabled: !mimeType,
    staleTime: MEDIA_ACCESS_URL_STALE_MS,
    refetchOnWindowFocus: false,
  });
  const mime = mimeType ?? accessUrlQuery.data?.mime_type;

  if (!mime) {
    if (accessUrlQuery.isError) {
      return (
        <div className="flex items-center gap-2 py-4 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {accessUrlQuery.error instanceof ApiClientError
            ? accessUrlQuery.error.message
            : "Couldn't load this file."}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    );
  }

  if (mime === PDF_MIME) return <PdfLessonViewer mediaAssetId={mediaAssetId} {...pdfProps} />;
  if (mime === DOCX_MIME)
    return <DocumentLessonViewer mediaAssetId={mediaAssetId} mimeType={mime} />;
  if (mime.startsWith("image/")) return <ProtectedImage mediaAssetId={mediaAssetId} />;

  return (
    <PreviewUnavailable>
      This file type can&apos;t be previewed in the portal, and downloading is not available.
    </PreviewUnavailable>
  );
}
