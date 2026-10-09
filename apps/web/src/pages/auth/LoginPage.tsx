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
    <div className="max-md:flex max-md:flex-1 max-md:flex-col">
      {/* text-[clamp(1.875rem,2.131vw,2.5rem)] handles the fluid sizing below 1536px
          (unchanged — still reproduces the reference's exact 1408px measurement); the
          added 2xl:text-[3rem] is an explicit client-specified value (48px) that takes
          over at >=1536px instead of continuing the fluid curve, per spec. */}
      <h1 className="max-w-[clamp(25.625rem,29.12vw,36rem)] text-[clamp(1.875rem,2.131vw,2.5rem)] max-md:text-[clamp(1.75rem,8.2vw,2.125rem)] max-md:leading-[1.25] 2xl:text-[3rem] leading-[1.2] font-bold text-white">
        Welcome to your Learning Hub
      </h1>
      {/* text-sm (14px) below 1536px — unchanged from before; 2xl:text-[1.5rem] is the
          client-specified 24px value for >=1536px only. */}
      <p className="mt-6 text-sm max-md:text-[clamp(1.125rem,5.3vw,1.375rem)] max-md:leading-[1.45] 2xl:text-[1.5rem] font-medium text-white/80">
        Log in to access programmes, tools &amp; support
      </p>
      {/* Flexible space surrounds the compact form on tall phones; its content
          height remains natural so short screens and validation errors scroll. */}
      <form className="mt-7 space-y-4 max-md:flex max-md:flex-1 max-md:flex-col max-md:justify-center max-md:space-y-3" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white/90">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-transparent bg-white px-3 py-[0.475rem] text-base focus:border-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-900"
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
            className="mt-1 w-full rounded-md border border-transparent bg-white px-3 py-[0.475rem] text-base focus:border-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-900"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-300">{errors.password.message}</p>
          )}
        </div>
        <div className="-mt-2 text-right max-md:mt-0">
          <Link to="/forgot-password" className="text-base font-medium text-white hover:underline">
            Forgot Password?
          </Link>
        </div>
        {submitError && <p className="text-sm text-red-300">{submitError}</p>}
        {/* Compact, centered — not w-full — and color pinned to the reference design's
            exact sampled button color via an important-prefixed arbitrary value; the
            shared Button component's own `primary` variant (bg-indigo-900, full-width
            callers elsewhere) stays untouched. Centering needs a wrapper rather than
            mx-auto on the button itself: Button's own base class is inline-flex
            (inline-level), which auto margins can't center. !text-base (1rem, overriding
            the shared component's own text-sm) and leading-[1.84615385] are client-
            specified exact values, local to this one button. */}
        <div className="flex justify-center">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2 !bg-[#552D99] hover:!bg-[#46257D] !text-base leading-[1.84615385] max-md:px-6 max-md:leading-[1.75]"
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
        </div>
      </form>
      {/* PCTR accounts are admin-created, not self-registered (SYSTEM_PLAN.md §9) — this
          is a contact note, never a sign-up link/form, matching the approved reference
          design, which shows this as a permanent fixture rather than something that only
          appears once a Support Email happens to be configured. supportEmail (Admin
          Settings) is reused as-is when present (a mailto link); with none configured,
          the same copy still shows, just as plain text rather than a dead mailto link. */}
      <div className="mt-6 flex items-center gap-3 text-xs text-white/50 max-md:mt-8 max-md:gap-2 max-md:text-sm max-md:text-white">
        <div className="h-px flex-1 bg-white/15" />
        or
        <div className="h-px flex-1 bg-white/15" />
      </div>
      <div className="mt-4 text-center text-sm text-white/70 max-md:mt-6 max-md:leading-[1.5]">
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
