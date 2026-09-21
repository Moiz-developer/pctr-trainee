import { useState } from "react";

/**
 * Shared sizing for every modal that previews a PDF, derived from the loaded PDF's own
 * first-page aspect ratio (reported by PdfLessonViewer's `onPageAspect`, and `null` again
 * once the viewer goes away — hidden, switched or the modal closed).
 *
 * The viewer's reading area is `100vh - PDF_MODAL_RESERVED_HEIGHT_PX` tall at most
 * (`reservedHeightPx` on PdfLessonViewer): the viewport minus the modal's own overlay
 * padding, panel padding, title row and toolbar (~176px), plus a few px of slack. Its
 * height is otherwise the page's own height, so the modal grows with the page.
 *
 * The width that makes a page fitted to the viewer's width exactly that tall is
 * `aspect × readingAreaHeight + chrome`, so the whole page shows without the PDF (or
 * the modal) scrolling: portrait pages get a narrower, tall modal, landscape pages a wide
 * one. Only a page that cannot fit — a very small screen, or an extreme aspect ratio hitting
 * the width limits below — falls back to normal scrolling. A modal that also holds other
 * content (lesson list, announcement text) keeps its own scroll for it.
 *
 * Usage: `const fit = usePdfModalSizing(PDF_ONLY_MODAL)`, then `<Modal size={fit.size ?? …}
 * maxWidth={fit.maxWidth}>` and pass `fit.viewerProps` to PdfLessonViewer (or to
 * ProtectedFileViewer as `pdfProps`). Non-modal viewers simply don't opt in.
 */
export const PDF_MODAL_RESERVED_HEIGHT_PX = 184;

const PDF_MODAL_MAX_WIDTH_PX = 1900;

export interface PdfModalWidthProfile {
  /** Horizontal space between the modal's edge and the PDF page (paddings, borders, scrollbar gutter). */
  chromeWidthPx: number;
  /** Lower bound so the toolbar (and anything else in the modal) stays usable next to a very tall page. */
  minWidthPx: number;
}

/** The viewer sits directly in the modal panel: panel padding (48) + viewer border (2) + scrollbar gutter (~15), rounded up. */
export const PDF_ONLY_MODAL: PdfModalWidthProfile = { chromeWidthPx: 72, minWidthPx: 420 };

/** The lesson modal also nests the viewer in a padded, bordered lesson card (+42px) beside the lesson list. */
export const PDF_LESSON_MODAL: PdfModalWidthProfile = { chromeWidthPx: 120, minWidthPx: 720 };

/** The props PdfLessonViewer needs to take part in modal sizing. */
export interface PdfViewerSizingProps {
  onPageAspect: (aspect: number | null) => void;
  reservedHeightPx: number;
}

/** CSS `max-width` for the modal: the width above, bounded by the viewport minus the overlay's 2rem padding. */
function pdfModalMaxWidth(aspect: number, profile: PdfModalWidthProfile): string {
  const fitted = `calc(${aspect.toFixed(4)} * (100vh - ${PDF_MODAL_RESERVED_HEIGHT_PX}px) + ${profile.chromeWidthPx}px)`;
  return `min(${PDF_MODAL_MAX_WIDTH_PX}px, calc(100vw - 2rem), max(${profile.minWidthPx}px, ${fitted}))`;
}

/**
 * Holds the reported aspect ratio for one modal. Before a PDF has loaded (or when none is
 * showing) `size`/`maxWidth` are undefined, so the modal keeps whatever size it already had.
 */
export function usePdfModalSizing(profile: PdfModalWidthProfile) {
  const [aspect, setAspect] = useState<number | null>(null);
  return {
    viewerProps: {
      onPageAspect: setAspect,
      reservedHeightPx: PDF_MODAL_RESERVED_HEIGHT_PX,
    } satisfies PdfViewerSizingProps,
    size: aspect === null ? undefined : ("viewer" as const),
    maxWidth: aspect === null ? undefined : pdfModalMaxWidth(aspect, profile),
  };
}
