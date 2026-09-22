import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { useBranding } from "../components/shared/useBranding";

/** Layout for unauthenticated routes (SYSTEM_PLAN.md §27 layouts/ "AuthLayout"). */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { platformName, platformDescription, supportEmail, loginLogoUrl, logoUrl } = useBranding();
  // Login Page Logo (Admin Settings -> Branding) is an optional override just for these
  // unauthenticated pages; when the admin hasn't set one, the same Platform Logo shown
  // everywhere else in the app is reused here, so one upload still reaches this page.
  const shownLogo = loginLogoUrl ?? logoUrl;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-700 px-4">
      <div className="mb-6 flex items-center gap-2.5 text-white">
        {shownLogo ? (
          // A configured logo replaces the name/description entirely (never rendered alongside
          // it) — the white backing plate keeps a dark-colored logo visible against this page's
          // dark gradient, and the taller, wider box gives it room to render at a legible size
          // instead of being squeezed into a small fixed box.
          <div className="rounded-md bg-white/95 px-4 py-2.5 shadow-sm">
            <img
              src={shownLogo}
              alt={platformName ?? "Platform logo"}
              className="h-12 max-w-[14rem] object-contain"
            />
          </div>
        ) : (
          <>
            <Star className="h-8 w-8 fill-accent text-accent" aria-hidden="true" />
            <div className="leading-tight">
              <p className="text-xl font-bold tracking-tight">{platformName ?? "PCTR"}</p>
              <p className="line-clamp-2 max-w-[16rem] text-[10px] font-medium uppercase tracking-wider text-white/70">
                {platformDescription ?? "Training & Recruitment"}
              </p>
            </div>
          </>
        )}
      </div>
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl">{children}</div>
      {supportEmail && (
        <p className="mt-5 text-center text-xs text-white/70">
          Need help?{" "}
          <a href={`mailto:${supportEmail}`} className="font-medium text-white underline">
            {supportEmail}
          </a>
        </p>
      )}
    </div>
  );
}
