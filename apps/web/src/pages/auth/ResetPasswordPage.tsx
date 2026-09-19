import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { updatePassword } from "../../services/supabase/auth";
import { useAuth } from "../../auth/useAuth";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/FormField";
import { useToast } from "../../components/ui/Toast";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/**
 * Supabase reports an invalid/expired recovery link as `#error=...` on the
 * redirect URL. Read once at mount so a signed-in visitor holding an expired
 * link isn't shown the form as if the link were valid.
 */
function hasLinkError(): boolean {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.has("error") || params.has("error_code") || params.has("error_description");
}

function InvalidLink() {
  return (
    <div>
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/60 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
        <div>
          <h1 className="text-base font-semibold text-indigo-950">Reset link invalid or expired</h1>
          <p className="mt-1 text-sm text-slate-600">
            This password reset link is invalid or has expired. Request a new one to continue.
          </p>
        </div>
      </div>
      <Link
        to="/forgot-password"
        className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-indigo-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-800"
      >
        Request a new link
      </Link>
      <Link
        to="/login"
        className="mt-3 block text-center text-sm font-medium text-indigo-800 hover:underline"
      >
        Back to login
      </Link>
    </div>
  );
}

/**
 * Destination of the Supabase password-recovery email link. The existing
 * Supabase client turns the link into a session (surfaced by AuthProvider's
 * `session`), so a session here means a valid recovery link; no session means
 * the link was invalid, expired or never used. On success the user is signed
 * out and sent to the normal login screen.
 */
export function ResetPasswordPage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [linkError] = useState(hasLinkError);
  const [finished, setFinished] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async (values: ResetPasswordValues) => {
    try {
      await updatePassword(values.password);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "We couldn't update your password. Please try again.",
      );
      return;
    }
    setFinished(true);
    // Recovery sessions shouldn't stay signed in: end it so the user logs in normally.
    await signOut().catch(() => undefined);
    toast.success("Your password has been updated. Please sign in with your new password.");
    void navigate("/login", { replace: true });
  };

  if (finished) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-900" aria-hidden="true" />
        Password updated. Taking you to sign in…
      </div>
    );
  }

  if (linkError) return <InvalidLink />;

  if (session === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-900" aria-hidden="true" />
        Verifying your reset link…
      </div>
    );
  }

  if (session === null) return <InvalidLink />;

  return (
    <div>
      <h1 className="text-lg font-semibold text-indigo-950">Set a new password</h1>
      <p className="mt-1 text-sm text-slate-500">Choose a new password for your account.</p>
      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      >
        <TextField
          label="New password"
          id="password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <TextField
          label="Confirm new password"
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
        <Link
          to="/login"
          className="block text-center text-sm font-medium text-indigo-800 hover:underline"
        >
          Back to login
        </Link>
      </form>
    </div>
  );
}
