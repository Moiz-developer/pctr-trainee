import { PreviewUnavailable } from "./PreviewUnavailable";

/**
 * PPT/PPTX lesson content. No small, well-maintained, purely-client-side
 * PPT/PPTX renderer comparable to pdf.js (PDF) or mammoth (DOCX) exists in
 * this stack, and none is added here (no new architecture/dependency).
 * Protected training content is viewable in the portal only — there is
 * deliberately no download fallback — so until presentations are converted to
 * PDF (or restricted), this reports the file as unavailable instead of
 * handing out its signed Storage URL.
 */
export function PresentationLessonViewer(_props: { mediaAssetId: string }) {
  return (
    <PreviewUnavailable>
      Presentation files (PPT/PPTX) can&apos;t be previewed in the portal, and downloading is not
      available. Ask your administrator to provide this presentation as a PDF.
    </PreviewUnavailable>
  );
}
