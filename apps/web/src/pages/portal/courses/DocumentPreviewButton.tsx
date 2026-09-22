import { useState } from "react";
import { Eye, type LucideIcon } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ProtectedFileViewer } from "./ProtectedFileViewer";
import { usePdfModalSizing } from "./pdfModalSizing";

const PDF_MIME = "application/pdf";

/**
 * The one "open a protected file in its own modal" pattern for every document-preview entry
 * point in the portal (Resources, Policies — UI consistency unit): a "View" button that opens
 * `ProtectedFileViewer` (the existing PDF/DOCX/image dispatcher, with its own honest "preview not
 * available" fallback for anything else, e.g. .xls/.xlsx or legacy .doc) inside a `Modal`, sized
 * to the page when it's a PDF (pdfModalSizing.ts, shared by every PDF modal in the app).
 *
 * Consolidates what used to be two near-identical hand-rolled implementations
 * (ResourcesPage.tsx's InAppDocumentButton, PoliciesPage.tsx's ViewButton) into one, so every
 * document preview behaves identically — including a fix the duplication had let drift: Policies'
 * own copy special-cased only PDF vs DOCX and had no image/"unsupported" fallback at all.
 *
 * Deliberately always the shared `Button` component's default (primary/purple) styling — the
 * app's one primary-action colour — never a bespoke or "secondary" colour per call site, so a
 * document's primary action reads the same everywhere it appears.
 */
export function DocumentPreviewButton({
  mediaAssetId,
  mimeType,
  title,
  icon: Icon = Eye,
  className,
}: {
  mediaAssetId: string;
  mimeType?: string | null;
  /** Modal title — typically the resource/document's own title. */
  title: string;
  icon?: LucideIcon;
  /** Sizing/layout for the button only (e.g. full-width card button vs. compact table button). */
  className: string;
}) {
  const [open, setOpen] = useState(false);
  // Sizes the modal to the PDF's page (shared with every PDF modal, see pdfModalSizing.ts).
  const pdfFit = usePdfModalSizing();

  return (
    <>
      <Button className={className} onClick={() => setOpen(true)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        View
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        wide
        size={pdfFit.size ?? (mimeType === PDF_MIME ? "xl" : undefined)}
        maxWidth={pdfFit.maxWidth}
      >
        <ProtectedFileViewer
          mediaAssetId={mediaAssetId}
          mimeType={mimeType}
          pdfProps={pdfFit.viewerProps}
        />
      </Modal>
    </>
  );
}
