import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";

export interface AdminCourseTabDef<K extends string> {
  id: K;
  label: string;
  icon: LucideIcon;
}

/**
 * The section switch on Admin Course Details. Same behaviour as before (one
 * active tab, the page renders its panel) — restyled as a segmented bar in the
 * PCTR card style, with a real ARIA tablist: the active tab is the only tab
 * stop and the arrow keys move between tabs. Tabs wrap onto extra rows on
 * narrow screens rather than scrolling sideways.
 */
export function AdminCourseTabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: AdminCourseTabDef<K>[];
  active: K;
  onChange: (id: K) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === active);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (next) {
      onChange(next.id);
      document.getElementById(`course-admin-tab-${next.id}`)?.focus();
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Course sections"
      onKeyDown={handleKeyDown}
      className="flex flex-wrap gap-1 rounded-lg bg-white p-1.5 shadow-[0_1px_4px_rgba(49,44,133,0.10)]"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            id={`course-admin-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`course-admin-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
              selected
                ? "bg-indigo-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-900"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
