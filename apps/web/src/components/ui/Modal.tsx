import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /** Panel width; overrides `wide`. Omit for the existing sm/wide behaviour. `xl` is for full-page-style views. */
  size?: "xl";
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
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white p-6 shadow-xl ${size === "xl" ? "max-w-6xl" : wide ? "max-w-2xl" : "max-w-md"}`}
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
