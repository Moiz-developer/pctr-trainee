import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
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
  const { supportEmail } = useBranding();
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
      <h1 className="text-2xl font-bold text-white">Welcome to your Learning Hub</h1>
      <p className="mt-1.5 text-sm font-medium text-white/80">
        Log in to access programmes, tools &amp; support
      </p>
      <form className="mt-7 space-y-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white/90">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-transparent bg-white px-3 py-2 text-sm focus:border-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-900"
            {...register("email")}
          />
          {errors.email && <p className="mt-1 text-xs text-red-300">{errors.email.message}</p>}
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-white/90">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-transparent bg-white px-3 py-2 text-sm focus:border-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-900"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-300">{errors.password.message}</p>
          )}
        </div>
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="text-sm font-medium text-white hover:underline">
            Forgot Password?
          </Link>
        </div>
        {submitError && <p className="text-sm text-red-300">{submitError}</p>}
        {/* Color pinned to the reference design's exact sampled button color via an
            important-prefixed arbitrary value — the shared Button component's own
            `primary` variant (bg-indigo-900, used everywhere else in the app) stays
            untouched; this override is local to this one button. */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full gap-2 !bg-[#552D99] hover:!bg-[#46257D]"
        >
          {isSubmitting ? (
            "Signing in…"
          ) : (
            <>
              Sign In &amp; Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>
      {/* PCTR accounts are admin-created, not self-registered (SYSTEM_PLAN.md §9) — this
          is a contact note, never a sign-up link/form, matching the approved reference
          design, which shows this as a permanent fixture rather than something that only
          appears once a Support Email happens to be configured. supportEmail (Admin
          Settings) is reused as-is when present (a mailto link); with none configured,
          the same copy still shows, just as plain text rather than a dead mailto link. */}
      <div className="mt-6 flex items-center gap-3 text-xs text-white/50">
        <div className="h-px flex-1 bg-white/15" />
        or
        <div className="h-px flex-1 bg-white/15" />
      </div>
      <div className="mt-4 text-center text-xs text-white/70">
        Don&apos;t have an account yet?{" "}
        {supportEmail ? (
          <a href={`mailto:${supportEmail}`} className="font-medium text-white underline">
            Contact PCTR Team For Account Creation
          </a>
        ) : (
          <span className="font-medium text-white">Contact PCTR Team For Account Creation</span>
        )}
      </div>
    </div>
  );
}
