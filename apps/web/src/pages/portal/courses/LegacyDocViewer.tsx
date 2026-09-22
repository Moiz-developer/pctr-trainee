import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ApiClientError } from "../../../services/api/client";
import { getDocPreviewText } from "../../../services/api/media";
import { RichText } from "../../../components/ui/RichText";
import { DocumentPage } from "./DocumentPage";

// Exported so callers can detect a legacy .doc file themselves and choose to render this viewer,
// the same way DocumentLessonViewer.tsx exports DOCX_MIME.
export const DOC_MIME = "application/msword";

/**
 * In-app viewer for legacy `.doc` (Document preview UI consistency unit). Unlike modern `.docx`
 * (an OOXML zip `mammoth` converts entirely client-side, DocumentLessonViewer.tsx), `.doc` is a
 * binary OLE/CFB container with no safe in-browser parser — its text is extracted server-side
 * instead (`GET /media/:id/doc-preview`, media.service.ts's `getDocPreviewText`, gated by the
 * exact same authorization `GET /media/:id/access-url` already enforces for this asset) and
 * returned as plain text, never HTML: this only ever renders through the existing `RichText`
 * component, which already sanitizes/typesets a plain-text value exactly like any other one (no
 * new rendering or sanitization logic here). What's lost versus DOCX: heading/bold/list structure
 * — `.doc` extraction is text-only, so the preview is plain paragraphs.
 */
export function LegacyDocViewer({ mediaAssetId }: { mediaAssetId: string }) {
  const query = useQuery({
    queryKey: ["doc-preview", mediaAssetId],
    queryFn: () => getDocPreviewText(mediaAssetId),
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading document…
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-red-600">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {query.error instanceof ApiClientError
          ? query.error.message
          : "This document could not be displayed — the file may be corrupted or in an unsupported format."}
        <button
          type="button"
          className="cursor-pointer font-medium underline"
          onClick={() => void query.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  const text = (query.data?.text ?? "").trim();
  if (!text) {
    return <p className="py-4 text-center text-sm text-slate-400">This document is empty.</p>;
  }

  return (
    <DocumentPage>
      <RichText value={text} className="text-sm text-slate-700" />
    </DocumentPage>
  );
}
