import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { requestPasswordReset } from "../../services/supabase/auth";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/FormField";
import { useToast } from "../../components/ui/Toast";

const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address."),
});
type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

const SUCCESS_MESSAGE = "If an account exists for this email, we've sent a password reset link.";

/**
 * Password reset request. Uses the existing Supabase Auth client
 * (`resetPasswordForEmail`) — no custom backend or tokens. The success copy
 * is identical whether or not the address is registered, so it never reveals
 * which emails have accounts.
 */
export function ForgotPasswordPage() {
  const toast = useToast();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (values: ForgotPasswordValues) => {
    try {
      await requestPasswordReset(values.email);
      setSent(true);
      toast.success(SUCCESS_MESSAGE);
    } catch {
      // Deliberately generic: never echo Supabase's reason (rate limit, etc.)
      // in a way that could hint at whether an account exists.
      toast.error("We couldn't send the reset link right now. Please try again in a moment.");
    }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-indigo-950">Forgot password</h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {sent ? (
        <div className="mt-6 space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <p className="text-sm text-slate-700">{SUCCESS_MESSAGE}</p>
          </div>
          <Link
            to="/login"
            className="block text-center text-sm font-medium text-indigo-800 hover:underline"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        >
          <TextField
            label="Email"
            id="email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Sending…" : "Send Reset Link"}
          </Button>
          <Link
            to="/login"
            className="block text-center text-sm font-medium text-indigo-800 hover:underline"
          >
            Back to login
          </Link>
        </form>
      )}
    </div>
  );
}
