import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

// min(…, 100vw − the overlay's 2rem padding) keeps every size inside the viewport on small screens.
const PANEL_SIZE_CLASS = {
  default: "max-h-[90vh] max-w-md",
  wide: "max-h-[90vh] max-w-2xl",
  xl: "max-h-[90vh] max-w-6xl",
  // Nearly the whole viewport tall; the width is set by the caller's `maxWidth`.
  viewer: "max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]",
} as const;

/**
 * Minimal reusable modal dialog — no primitive like this existed yet, and
 * course/module/lesson/access create-edit forms all need one. Same
 * dependency-free approach as components/ui/Button.tsx (no shadcn/ui
 * installed, so a small primitive rather than a new UI library).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  size,
  maxWidth,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /**
   * Panel size; overrides `wide`. Omit for the existing sm/wide behaviour. `xl` is for
   * full-page-style views; `viewer` is for document viewers (nearly the full viewport
   * height, width from `maxWidth`).
   */
  size?: "xl" | "viewer";
  /** CSS max-width for the panel; overrides the width from `size`. Keep it within the viewport. */
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={maxWidth ? { maxWidth } : undefined}
        className={`relative w-full overflow-y-auto rounded-lg bg-white p-6 shadow-xl ${PANEL_SIZE_CLASS[size ?? (wide ? "wide" : "default")]}`}
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-semibold text-indigo-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
