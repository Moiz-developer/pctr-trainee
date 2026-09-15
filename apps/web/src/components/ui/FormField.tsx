import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Small composable form-field primitives (label + control + error message).
 * None existed yet — LoginPage hand-rolled its two fields inline; this unit
 * needs many more fields across course/module/lesson forms, so a shared,
 * dependency-free wrapper avoids repeating that markup. Designed to be used
 * with react-hook-form's `register()` spread, same as LoginPage already does.
 */
function FieldShell({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const controlClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400";

export function TextField({
  label,
  id,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; error?: string }) {
  return (
    <FieldShell label={label} htmlFor={id} error={error}>
      <input id={id} className={`${controlClass} ${className}`} {...props} />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  id,
  error,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string; error?: string }) {
  return (
    <FieldShell label={label} htmlFor={id} error={error}>
      <textarea id={id} rows={3} className={`${controlClass} ${className}`} {...props} />
    </FieldShell>
  );
}

export function SelectField({
  label,
  id,
  error,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string; error?: string }) {
  return (
    <FieldShell label={label} htmlFor={id} error={error}>
      <select id={id} className={`${controlClass} bg-white ${className}`} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  id,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-slate-700">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-indigo-900 focus:ring-indigo-500"
          {...props}
        />
        {label}
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
