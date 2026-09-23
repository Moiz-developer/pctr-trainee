import { useState } from "react";

/**
 * Shared sizing for every modal that previews a PDF: the modal follows the loaded PDF's
 * own first page. No fixed widths or paddings are assumed — once the viewer is on screen it
 * measures how much of the modal is *not* PDF (`measurePdfModalChrome`) and reports that
 * with the page's aspect ratio (`PdfPageFit`, via PdfLessonViewer's `onPageFit`; `null`
 * again when the viewer goes away — hidden, switched, modal closed).
 *
 * Reading area: the viewer is at most `100vh - reservedHeightPx` tall (the viewport minus
 * the modal's overlay padding, title, toolbar and nested paddings, all measured), and
 * otherwise exactly as tall as the page. The modal is then as wide as the page is at that
 * height, plus the measured horizontal chrome:
 *
 *   maxWidth = min(100vw - 2rem, aspect × (100vh - reservedHeightPx) + chromeWidthPx)
 *
 * So the page fills the reading area edge to edge (portrait → a tall, narrower modal;
 * landscape → a wide, shorter one) and the modal grows and shrinks with the viewport,
 * always inside it. A page that cannot fit — a phone, or an extreme aspect ratio — is
 * simply the viewport width, and the PDF (or a modal that also holds a lesson list or
 * announcement text) scrolls as normal.
 *
 * Usage: `const fit = usePdfModalSizing()`, then `<Modal size={fit.size ?? …}
 * maxWidth={fit.maxWidth}>` and pass `fit.viewerProps` to PdfLessonViewer (or to
 * ProtectedFileViewer as `pdfProps`). Non-modal viewers simply don't opt in.
 */
export interface PdfPageFit {
  /** First page's width / height, rotation included. */
  aspect: number;
  /** Modal edge to PDF page, horizontally: paddings, borders and the viewer's scrollbar gutter. */
  chromeWidthPx: number;
  /** Everything that shares the viewport height with the reading area (see above). */
  reservedHeightPx: number;
}

/** The props PdfLessonViewer needs to take part in modal sizing. */
export interface PdfViewerSizingProps {
  onPageFit: (fit: PdfPageFit | null) => void;
  /** Fed back from the reported fit, so the viewer caps its reading area to the same height. */
  reservedHeightPx: number | undefined;
}

const px = (value: string) => parseFloat(value) || 0;

/** Vertical padding + border of an element. */
function verticalBox(el: Element) {
  const style = getComputedStyle(el);
  return (
    px(style.paddingTop) +
    px(style.paddingBottom) +
    px(style.borderTopWidth) +
    px(style.borderBottomWidth)
  );
}

/**
 * Measures the modal around a visible PDF scroll area (`wrapper`, inside the viewer's root
 * next to its toolbar, inside the Modal's role="dialog" panel). Returns null when the viewer
 * is not inside a Modal, so a non-modal viewer never reports a fit.
 */
export function measurePdfModalChrome(
  wrapper: HTMLElement,
): Pick<PdfPageFit, "chromeWidthPx" | "reservedHeightPx"> | null {
  const dialog = wrapper.closest<HTMLElement>('[role="dialog"]');
  const overlay = dialog?.parentElement;
  const viewerRoot = wrapper.parentElement;
  if (!dialog || !overlay || !viewerRoot) return null;

  // Vertical: the viewer's own toolbar + gaps, every padding/border between the viewer and
  // the panel edge (the panel's own, a lesson card's…), the title row, and the overlay's.
  let reserved = viewerRoot.offsetHeight - wrapper.offsetHeight;
  for (let el = viewerRoot.parentElement; el; el = el.parentElement) {
    reserved += verticalBox(el);
    if (el === dialog) break;
  }
  const title = dialog.firstElementChild;
  if (title instanceof HTMLElement) {
    reserved += title.offsetHeight + px(getComputedStyle(title).marginBottom);
  }
  reserved += verticalBox(overlay);

  return {
    chromeWidthPx: dialog.offsetWidth - wrapper.clientWidth,
    // +1: rounding, so the page ends a hair shorter than the space, never taller.
    reservedHeightPx: Math.ceil(reserved) + 1,
  };
}

// function pdfModalMaxWidth({ aspect, chromeWidthPx, reservedHeightPx }: PdfPageFit): string {
//   return `min(calc(100vw - 2rem), calc(${aspect.toFixed(4)} * (100vh - ${reservedHeightPx}px) + ${chromeWidthPx}px))`;
// }
// function pdfModalMaxWidth(): undefined {
//   return undefined;
// }
/**
 * Holds the reported fit for one modal. Before a PDF has loaded (or when none is showing)
 * `size`/`maxWidth` are undefined, so the modal keeps whatever size it already had.
 */
export function usePdfModalSizing() {
  const [fit, setFit] = useState<PdfPageFit | null>(null);
  return {
    viewerProps: {
      onPageFit: setFit,
      reservedHeightPx: fit?.reservedHeightPx,
    } satisfies PdfViewerSizingProps,
    size: fit ? ("viewer" as const) : undefined,
    maxWidth: undefined,
    //  fit ? pdfModalMaxWidth(fit) : undefined,
  };
}
