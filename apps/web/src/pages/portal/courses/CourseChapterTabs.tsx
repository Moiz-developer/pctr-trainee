import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";

export interface ChapterTabDef<K extends string> {
  key: K;
  label: string;
  icon: LucideIcon;
  /** Second line, e.g. "3 chapters · 67%". */
  caption: string;
}

/**
 * The Training / Practical switch on the course page. Two large cards (the same
 * dark-active, amber-corner treatment as the lesson view's type cards) so the
 * two kinds of content are clearly separate instead of stacked on one page.
 * A real ARIA tablist: the active tab is the only tab stop and the arrow keys
 * move between tabs. Panels are rendered by the page with matching ids.
 */
export function CourseChapterTabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: ChapterTabDef<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.key === active);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (next) {
      onChange(next.key);
      document.getElementById(`course-tab-${next.key}`)?.focus();
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Course content"
      onKeyDown={handleKeyDown}
      className="grid grid-cols-2 gap-3 sm:gap-4"
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            id={`course-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`course-panel-${tab.key}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={`relative flex cursor-pointer flex-col items-center overflow-hidden rounded-lg px-3 py-4 text-center shadow-[0_1px_4px_rgba(49,44,133,0.10)] transition-colors sm:py-6 ${
              selected ? "bg-indigo-950 text-white" : "bg-white text-indigo-950 hover:bg-indigo-50"
            }`}
          >
            <span
              className="absolute -right-6 -top-6 h-14 w-14 rounded-full bg-accent"
              aria-hidden="true"
            />
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
            <span className="mt-1.5 text-base font-semibold sm:text-lg">{tab.label}</span>
            <span className={`text-xs ${selected ? "text-white/80" : "text-slate-500"}`}>
              {tab.caption}
            </span>
          </button>
        );
      })}
    </div>
  );
}
