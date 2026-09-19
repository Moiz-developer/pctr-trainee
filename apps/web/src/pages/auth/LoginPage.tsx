import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { signInWithPassword } from "../../services/supabase/auth";
import { Button } from "../../components/ui/Button";
import { useBranding } from "../../components/shared/useBranding";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required."),
});
type LoginFormValues = z.infer<typeof loginSchema>;

/** SYSTEM_PLAN.md §9: Supabase email/password sign-in. */
export function LoginPage() {
  const navigate = useNavigate();
  const { platformName } = useBranding();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    try {
      await signInWithPassword(values.email, values.password);
      void navigate("/", { replace: true });
    } catch {
      // Generic message regardless of failure reason (SYSTEM_PLAN.md §9's
      // no-user-enumeration rule) — Supabase's own error is already generic.
      setSubmitError("Invalid email or password.");
    }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-indigo-950">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">{platformName ?? "Internal Training Platform"}</p>
      <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-900"
            {...register("email")}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-900"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>
        <div className="-mt-2 text-right">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-indigo-800 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
