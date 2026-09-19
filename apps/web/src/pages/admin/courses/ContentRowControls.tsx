import { ArrowDown, ArrowUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_BUTTON_CLASS =
  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-900 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent disabled:hover:text-slate-300";

/** A single icon action on a module/lesson row (edit, media…) with a visible hover state and tooltip. */
export function RowIconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${ICON_BUTTON_CLASS} border border-slate-200 bg-white`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/**
 * Move up / move down as one grouped control, shared by the module and lesson
 * rows so both levels look and behave the same. The callers keep the existing
 * swap-`sort_order` logic; this only draws the buttons.
 */
export function ReorderControls({
  canMoveUp,
  canMoveDown,
  disabled,
  onMoveUp,
  onMoveDown,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="inline-flex items-center divide-x divide-slate-200 rounded-md border border-slate-200 bg-white">
      <button
        type="button"
        className={ICON_BUTTON_CLASS}
        disabled={!canMoveUp || disabled}
        onClick={onMoveUp}
        aria-label="Move up"
        title="Move up"
      >
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={ICON_BUTTON_CLASS}
        disabled={!canMoveDown || disabled}
        onClick={onMoveDown}
        aria-label="Move down"
        title="Move down"
      >
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
