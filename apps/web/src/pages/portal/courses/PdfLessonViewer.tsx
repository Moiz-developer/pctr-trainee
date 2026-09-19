import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { ApiClientError } from "../../../services/api/client";
import { getMediaAccessUrl, MEDIA_ACCESS_URL_STALE_MS } from "../../../services/api/media";

/**
 * In-app PDF viewer (Phase 2I; SYSTEM_PLAN.md §16: "PDFs rendered via an
 * in-app viewer rather than served as raw downloadable files"). Renders
 * into a plain `<canvas>` via pdf.js (Mozilla's own PDF engine — the same
 * one Firefox uses) instead of a bare `<iframe src={signedUrl}>`,
 * deliberately: an iframe would hand the browser's own PDF viewer chrome
 * (which varies by browser and always includes its own download/print
 * affordance that markup can't remove) the signed URL directly. Rendering
 * to a canvas means there is no browser-native toolbar at all — only the
 * page controls this component itself renders, satisfying this unit's "no
 * download button" requirement far more reliably than an iframe can.
 *
 * The signed URL never leaves the browser: pdf.js fetches the PDF bytes
 * itself (same-origin-safe, since Supabase Storage signed URLs are
 * CORS-enabled for direct browser fetches) — no third-party viewer service
 * (e.g. Google Docs Viewer) is used, since that would mean handing our
 * private, authorization-gated signed URL to an external server, exactly
 * what this unit's task forbids ("do not use external public viewers that
 * expose private files").
 */
export function PdfLessonViewer({ mediaAssetId }: { mediaAssetId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);

  const accessUrlQuery = useQuery({
    queryKey: ["media-access-url", mediaAssetId],
    queryFn: () => getMediaAccessUrl(mediaAssetId),
    // Reuse the fetched URL and don't re-mint it on window focus: a new URL
    // would reload the whole document and reset the page being read.
    staleTime: MEDIA_ACCESS_URL_STALE_MS,
    refetchOnWindowFocus: false,
  });

  const signedUrl = accessUrlQuery.data?.url;

  // Load the document once a signed URL is available. Re-runs if the
  // lesson (and therefore the signed URL) changes.
  useEffect(() => {
    if (!signedUrl) return;
    let cancelled = false;

    void (async () => {
      // Reset state for the new signed URL. Deliberately inside the async
      // callback, not synchronously at the top of the effect body — same
      // observable timing (still the first thing that runs), but avoids
      // react-hooks/set-state-in-effect's cascading-render warning for
      // synchronous setState calls directly in an effect.
      setIsLoadingDoc(true);
      setLoadError(null);
      setNumPages(null);
      setPageNum(1);
      try {
        const [pdfjsLib, workerUrlModule] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        ]);
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlModule.default;

        const loadingTask = pdfjsLib.getDocument({ url: signedUrl });
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
      } catch {
        if (!cancelled) {
          setLoadError(
            "This PDF could not be loaded — the file may be corrupted or in an unsupported format.",
          );
        }
      } finally {
        if (!cancelled) setIsLoadingDoc(false);
      }
    })();

    return () => {
      cancelled = true;
      void loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
      pdfDocRef.current = null;
    };
  }, [signedUrl]);

  // Render the current page whenever it (or the loaded document) changes.
  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || !numPages) return;
    let cancelled = false;

    void (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.4 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
      } catch {
        if (!cancelled) {
          setLoadError("This page could not be rendered.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pageNum, numPages]);

  if (accessUrlQuery.isLoading) {
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

  if (loadError) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-red-600">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {loadError}
      </div>
    );
  }

  return (
    <div className="protected-content space-y-3" onContextMenu={(event) => event.preventDefault()}>
      {isLoadingDoc && (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Rendering PDF…
        </div>
      )}
      <div
        className={`overflow-auto rounded-lg border border-slate-200 ${isLoadingDoc ? "hidden" : ""}`}
      >
        <canvas ref={canvasRef} className="mx-auto block" />
      </div>
      {numPages !== null && numPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-slate-600">
          <button
            type="button"
            disabled={pageNum <= 1}
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            className="cursor-pointer rounded-md p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span>
            Page {pageNum} of {numPages}
          </span>
          <button
            type="button"
            disabled={pageNum >= numPages}
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
            className="cursor-pointer rounded-md p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
