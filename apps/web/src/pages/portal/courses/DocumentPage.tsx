import type { ReactNode } from "react";

/**
 * The "paper on a tray" surface shared by every plain-text/HTML document preview — modern DOCX
 * (mammoth, DocumentLessonViewer.tsx) and legacy .doc (server-extracted plain text,
 * LegacyDocViewer.tsx). A muted tray behind a white page (reusing the same shadow Card.tsx's
 * white cards use) reads as an actual sheet of paper rather than a plain text dump; the page
 * itself, not this wrapper, is the only thing that scrolls, so the surrounding modal's header
 * never moves. PDF (already page-shaped, its own viewer) and the spreadsheet viewer (needs full
 * width for a table, not a narrow reading column) don't use this.
 */
export function DocumentPage({ children }: { children: ReactNode }) {
  return (
    <div
      className="protected-content rounded-lg bg-slate-100 p-3 sm:p-6"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="mx-auto max-h-[65vh] overflow-y-auto rounded-md border border-slate-200 bg-white p-6 shadow-[0_1px_4px_rgba(49,44,133,0.10)] sm:p-10">
        {children}
      </div>
    </div>
  );
}
