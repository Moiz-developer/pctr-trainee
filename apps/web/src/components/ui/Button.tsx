import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-indigo-900 text-white hover:bg-indigo-800",
  secondary: "bg-indigo-50 text-indigo-900 hover:bg-indigo-100",
  destructive: "bg-red-600 text-white hover:bg-red-500",
  ghost: "bg-transparent text-slate-700 hover:bg-indigo-50 hover:text-indigo-900",
};

/**
 * SYSTEM_PLAN.md §34: "A single Button component with a fixed set of
 * variants (primary/secondary/destructive/ghost) — no bespoke buttons per
 * page." No shadcn/ui is installed in this repo yet (nothing to build on
 * top of), so this is a small, dependency-free primitive covering the same
 * fixed variant set.
 */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
