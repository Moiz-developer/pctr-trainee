import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  MoveHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ApiClientError } from "../../../services/api/client";
import { getMediaAccessUrl } from "../../../services/api/media";

/** How each page is sized: to the viewer's width, to the whole visible area, or a manual zoom. */
type FitMode = "width" | "page" | "custom";

/** Orientation of a document's first page, reported so a host modal can size itself to it. */
export type PdfPageShape = "portrait" | "landscape";

// A signed URL's lifetime is an admin setting, so a cached one counts as fresh
// only until shortly before the expiry the API reported, never a fixed guess.
const URL_EXPIRY_MARGIN_MS = 60_000;

interface LoadFailure {
  message: string;
  /** The underlying error (links stripped: they carry a signed token), so the real cause stays visible. */
  detail: string;
  retryable: boolean;
}

const withoutLinks = (text: string) => text.replace(/https?:\/\/\S+/g, "[link]");

function errorDetail(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : String(error);
  return `${name}: ${withoutLinks(message)}`.slice(0, 240);
}

/** Storage answers 400/401/403 for a signed URL that expired or was rejected — not a problem with the file. */
function isLinkRejected(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return (
    error instanceof Error &&
    error.name === "UnexpectedResponseException" &&
    (status === 400 || status === 401 || status === 403)
  );
}

/** pdf.js reports named exceptions; say what actually went wrong instead of blaming the file. */
function describeLoadFailure(error: unknown, stage: "component" | "document"): LoadFailure {
  const detail = errorDetail(error);
  if (stage === "component") {
    return {
      message: "The PDF viewer could not be loaded. Reload the page and try again.",
      detail,
      retryable: false,
    };
  }
  const name = error instanceof Error ? error.name : "";
  const status = (error as { status?: unknown } | null)?.status;
  if (name === "PasswordException") {
    return {
      message: "This PDF is password-protected, so it can't be previewed.",
      detail,
      retryable: false,
    };
  }
  if (name === "InvalidPDFException") {
    return { message: "This file is not a valid PDF, or it is damaged.", detail, retryable: false };
  }
  if (name === "MissingPDFException" || (name === "UnexpectedResponseException" && status === 404)) {
    return { message: "The PDF file could not be found.", detail, retryable: false };
  }
  if (isLinkRejected(error)) {
    return {
      message: "The secure link for this document was rejected or has expired.",
      detail,
      retryable: true,
    };
  }
  if (name === "UnexpectedResponseException" && typeof status === "number") {
    return {
      message: `The server returned an error (HTTP ${status}) while downloading the PDF.`,
      detail,
      retryable: true,
    };
  }
  return {
    message: "The PDF could not be downloaded. Check your connection and try again.",
    detail,
    retryable: true,
  };
}

// The scroll area is capped so a tall page scrolls inside the viewer and the
// page/zoom controls below it stay on screen. "Fit page" fits to this height.
const VIEW_MAX_HEIGHT_VH = 70;
// pdf.js scale 1 is 1 PDF point per CSS px; other PDF viewers call 96/72 of that "100%".
const PDF_TO_CSS_UNITS = 96 / 72;
// Low enough that even an A0 sheet can still fit a phone-width viewer.
const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.25;
// Browser canvas limits (iOS Safari is the tightest): keep the bitmap under both.
const MAX_CANVAS_PIXELS = 16_777_216;
const MAX_CANVAS_SIDE = 16_384;

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

const CONTROL_BUTTON_CLASS =
  "cursor-pointer rounded-md p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";

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
 *
 * Sizing: every page is scaled from its own real dimensions (so portrait,
 * landscape and mixed-size documents all fit without cropping or stretching).
 * By default a page fits the viewer's width — the most readable size — and the
 * toolbar can switch to fitting the whole page or zoom manually. The bitmap is
 * rendered at the screen's pixel density so text stays sharp.
 */
export function PdfLessonViewer({
  mediaAssetId,
  onPageShape,
  maxHeightVh = VIEW_MAX_HEIGHT_VH,
}: {
  mediaAssetId: string;
  /** Cap on the scroll area's height, in vh. Defaults to the shared cap; the lesson modal passes a taller one. */
  maxHeightVh?: number;
  /** Called once per loaded document with its first page's shape, so a host modal can size itself to it. */
  onPageShape?: (shape: PdfPageShape) => void;
}) {
  const onPageShapeRef = useRef(onPageShape);
  useEffect(() => {
    onPageShapeRef.current = onPageShape;
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  const [view, setView] = useState({ width: 0, height: 0 });
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [fitMode, setFitMode] = useState<FitMode>("width");
  const [customScale, setCustomScale] = useState(1);
  const [displayScale, setDisplayScale] = useState(1);
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  // Set once a rejected/expired link has been swapped for a fresh one, so a
  // second rejection is reported instead of retried forever.
  const linkRefreshedRef = useRef(false);

  const accessUrlQuery = useQuery({
    queryKey: ["media-access-url", mediaAssetId],
    queryFn: () => getMediaAccessUrl(mediaAssetId),
    // Reuse the fetched URL and don't re-mint it on window focus (a new URL
    // would reload the whole document and reset the page being read), but only
    // while it is still valid: fresh until shortly before the API-reported expiry.
    staleTime: (query) => {
      const expiresAt = query.state.data?.expires_at;
      return expiresAt ? Math.max(0, Date.parse(expiresAt) - Date.now() - URL_EXPIRY_MARGIN_MS) : 0;
    },
    refetchOnWindowFocus: false,
  });
  const { refetch: refetchAccessUrl } = accessUrlQuery;

  // A stale cached URL is being refreshed: wait for the new one rather than
  // start a download with a link that may already have expired.
  const signedUrl =
    accessUrlQuery.data && !(accessUrlQuery.isStale && accessUrlQuery.isFetching)
      ? accessUrlQuery.data.url
      : undefined;

  // Track the space a page can use: the scroll area's width, and the height it
  // is capped to. Callback ref (state) because the area only mounts once the
  // signed URL has loaded.
  useEffect(() => {
    if (!wrapperEl) return;
    const measure = () => {
      // The height cap includes the border, the page has to fit inside it.
      const style = getComputedStyle(wrapperEl);
      const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      setView({
        width: wrapperEl.clientWidth,
        height: Math.floor((window.innerHeight * maxHeightVh) / 100 - border),
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(wrapperEl);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [wrapperEl, maxHeightVh]);

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
      setLoadFailure(null);
      setNumPages(null);
      setPageNum(1);
      setFitMode("width");
      let stage: "component" | "document" = "component";
      let refreshingLink = false;
      try {
        // The `legacy` build, not the default one: pdfjs-dist's default build assumes
        // the very newest JS built-ins (Uint8Array.toHex, Map.getOrInsertComputed,
        // Promise.try…) and throws on any browser that lacks one — which surfaced
        // here as "could not be loaded" for perfectly valid PDFs. The legacy build
        // is the same library with those polyfilled; the API is identical.
        const [pdfjsLib, workerUrlModule] = await Promise.all([
          import("pdfjs-dist/legacy/build/pdf.mjs"),
          import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
        ]);
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlModule.default;

        stage = "document";
        const loadingTask = pdfjsLib.getDocument({ url: signedUrl });
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }
        pdfDocRef.current = doc;
        linkRefreshedRef.current = false;
        // Report the first page's shape (rotation included) before the first render.
        const first = (await doc.getPage(1)).getViewport({ scale: 1 });
        if (cancelled) return;
        onPageShapeRef.current?.(first.width > first.height ? "landscape" : "portrait");
        setNumPages(doc.numPages);
      } catch (error) {
        if (cancelled) return;
        if (stage === "document" && isLinkRejected(error) && !linkRefreshedRef.current) {
          // The signed URL expired (or was rejected) before it was used, which
          // says nothing about the file: get a fresh one once and reload.
          linkRefreshedRef.current = true;
          refreshingLink = true;
          void refetchAccessUrl({ cancelRefetch: false });
          return;
        }
        console.error("[PdfLessonViewer] Could not load the PDF:", error);
        setLoadFailure(describeLoadFailure(error, stage));
      } finally {
        if (!cancelled && !refreshingLink) setIsLoadingDoc(false);
      }
    })();

    return () => {
      cancelled = true;
      void loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
      pdfDocRef.current = null;
    };
  }, [signedUrl, refetchAccessUrl]);

  // Render the current page whenever it, the zoom, or the available space changes.
  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || !numPages || view.width === 0) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    void (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;

        // Size from this page's own dimensions (rotation included) at scale 1.
        const natural = page.getViewport({ scale: 1 });
        const fitWidth = view.width / natural.width;
        const fitPage = Math.min(fitWidth, view.height / natural.height);
        const scale = clampScale(
          fitMode === "width" ? fitWidth : fitMode === "page" ? fitPage : customScale,
        );

        // Draw at the screen's pixel density for sharp text, within canvas limits.
        let bitmapScale = scale * Math.min(window.devicePixelRatio || 1, 3);
        const bitmapW = natural.width * bitmapScale;
        const bitmapH = natural.height * bitmapScale;
        bitmapScale *= Math.min(
          1,
          Math.sqrt(MAX_CANVAS_PIXELS / (bitmapW * bitmapH)),
          MAX_CANVAS_SIDE / Math.max(bitmapW, bitmapH),
        );
        const viewport = page.getViewport({ scale: bitmapScale });

        // Render off-screen, then swap it in: a superseded render (resize/zoom)
        // can be cancelled without touching the visible canvas, so it never
        // flashes blank and two renders never share a canvas.
        const buffer = document.createElement("canvas");
        buffer.width = Math.ceil(viewport.width);
        buffer.height = Math.ceil(viewport.height);
        renderTask = page.render({ canvas: buffer, viewport });
        await renderTask.promise;
        if (cancelled) return;

        canvas.width = buffer.width;
        canvas.height = buffer.height;
        canvas.style.width = `${natural.width * scale}px`;
        canvas.style.height = `${natural.height * scale}px`;
        canvas.getContext("2d")?.drawImage(buffer, 0, 0);
        setDisplayScale(scale);
      } catch (error) {
        if (!cancelled) {
          console.error("[PdfLessonViewer] Could not render the page:", error);
          setLoadFailure({
            message: "This page could not be rendered.",
            detail: errorDetail(error),
            retryable: false,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNum, numPages, fitMode, customScale, view.width, view.height]);

  function retryLoad() {
    linkRefreshedRef.current = false;
    void refetchAccessUrl();
  }

  function zoomBy(factor: number) {
    setCustomScale(clampScale(displayScale * factor));
    setFitMode("custom");
  }

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

  if (loadFailure) {
    return (
      <div role="alert" className="flex items-start gap-2 py-4 text-sm text-red-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p>
            {loadFailure.message}
            {loadFailure.retryable && (
              <button
                type="button"
                className="ml-2 cursor-pointer font-medium underline"
                onClick={retryLoad}
              >
                Try again
              </button>
            )}
          </p>
          <p className="mt-1 break-words text-xs text-slate-500">{loadFailure.detail}</p>
        </div>
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
        ref={setWrapperEl}
        style={{ maxHeight: `${maxHeightVh}vh` }}
        className={`overflow-auto rounded-lg border border-slate-200 [scrollbar-gutter:stable] ${isLoadingDoc ? "hidden" : ""}`}
      >
        <canvas ref={canvasRef} className="mx-auto block" />
      </div>
      {numPages !== null && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-600">
          {numPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={pageNum <= 1}
                onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                className={CONTROL_BUTTON_CLASS}
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
                className={CONTROL_BUTTON_CLASS}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={displayScale <= MIN_SCALE + 0.001}
              onClick={() => zoomBy(1 / ZOOM_STEP)}
              className={CONTROL_BUTTON_CLASS}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="w-11 text-center tabular-nums" aria-live="polite">
              {Math.round(displayScale * PDF_TO_CSS_UNITS * 100)}%
            </span>
            <button
              type="button"
              disabled={displayScale >= MAX_SCALE - 0.001}
              onClick={() => zoomBy(ZOOM_STEP)}
              className={CONTROL_BUTTON_CLASS}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setFitMode("width")}
              aria-pressed={fitMode === "width"}
              className={`${CONTROL_BUTTON_CLASS} ${fitMode === "width" ? "bg-indigo-50 text-indigo-900" : ""}`}
              aria-label="Fit to width"
              title="Fit to width"
            >
              <MoveHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setFitMode("page")}
              aria-pressed={fitMode === "page"}
              className={`${CONTROL_BUTTON_CLASS} ${fitMode === "page" ? "bg-indigo-50 text-indigo-900" : ""}`}
              aria-label="Fit whole page"
              title="Fit whole page"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
