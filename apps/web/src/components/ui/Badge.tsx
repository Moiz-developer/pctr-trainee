import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-indigo-50 text-indigo-800",
};

// Filled variant used for prominent status pills (course cards, per the
// redesign references' "Completed"/"Incompleted" pills).
const SOLID_TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-500 text-white",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-white",
  danger: "bg-rose-500 text-white",
  info: "bg-indigo-900 text-white",
};

/** Small status pill — used for CourseStatus, active/inactive, and access state throughout this unit. */
export function Badge({
  tone = "neutral",
  solid = false,
  children,
}: {
  tone?: BadgeTone;
  solid?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        solid ? SOLID_TONE_CLASSES[tone] : TONE_CLASSES[tone]
      }`}
    >
      {children}
    </span>
  );
}
