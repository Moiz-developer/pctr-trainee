import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { getMediaAccessUrl } from "../../../services/api/media";

// Exported (download restriction unit) so callers outside course lessons —
// ResourcesPage.tsx/PoliciesPage.tsx — can detect a DOCX file themselves and
// choose to render this same in-app viewer, without duplicating the literal
// MIME string or changing this component itself.
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Legacy `.doc` download action (mirrors ResourcesPage.tsx's DownloadButton
 * exactly — same on-demand `getMediaAccessUrl` mutation + `window.open(...,
 * "_blank", "noopener")`, never a stored/direct link). Resolved on click,
 * not eagerly like the DOCX viewer's `accessUrlQuery`, since a `.doc` file
 * is never fetched/converted client-side — the signed URL is only ever
 * needed once the trainee actually asks to download it.
 */
function DocDownloadButton({ mediaAssetId }: { mediaAssetId: string }) {
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: () => getMediaAccessUrl(mediaAssetId),
    onSuccess: (result) => {
      window.open(result.url, "_blank", "noopener");
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "Couldn't download this document.",
      );
    },
  });

  return (
    <Button
      variant="secondary"
      className="gap-1.5 px-2 py-1 text-xs"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      {mutation.isPending ? "Opening…" : "Download"}
    </Button>
  );
}

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
      <div className="space-y-3">
        <p className="text-sm text-slate-400">
          This is a legacy .doc file — only modern .docx documents can be viewed in-app (no safe
          in-browser reader exists for the older binary format). Download it to view it instead.
        </p>
        <DocDownloadButton mediaAssetId={mediaAssetId} />
      </div>
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
    <div
      className="max-h-[70vh] overflow-y-auto rounded-lg border border-slate-200 p-4 text-sm leading-relaxed text-slate-700"
      dangerouslySetInnerHTML={{ __html: html ?? "" }}
    />
  );
}
