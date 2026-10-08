import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { useBranding } from "../components/shared/useBranding";

/**
 * Layout for unauthenticated routes (SYSTEM_PLAN.md §27 layouts/ "AuthLayout") —
 * used by Login, Forgot Password and Reset Password alike (App.tsx), so a change
 * here applies to all three consistently. Two-column on desktop (form left,
 * branding right, on the same continuous gradient background); stacks form above
 * branding on small screens (`lg:flex-row` only kicks in at the `lg` breakpoint —
 * DOM order below is form-then-branding, so that's the natural mobile stack order
 * too, with no `order-*` override needed for either breakpoint).
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { platformName, platformDescription, supportEmail, loginLogoUrl, logoUrl } = useBranding();
  // Login Page Logo (Admin Settings -> Branding) is an optional override just for these
  // unauthenticated pages; when the admin hasn't set one, the same Platform Logo shown
  // everywhere else in the app is reused here, so one upload still reaches this page.
  const shownLogo = loginLogoUrl ?? logoUrl;

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-700 lg:flex-row">
      {/* Form side — the existing white card, unchanged other than the logo removed from it. */}
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-4 py-10 lg:w-1/2">
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

      {/* Branding side — large and prominent; this is the ONLY place the logo renders
          now (previously it also appeared small inside the card, duplicating it).
          min-w-0 on this flex item (and w-full+max-w-* rather than a bare intrinsic
          size on the <img>) is required — without it, a wide source image (this one
          is 1723px natively) sets this flex item's content-based minimum width and
          overflows a narrow mobile viewport instead of shrinking to fit it.
          object-contain sizes the logo to whatever aspect ratio the uploaded file
          actually has — an upload with a lot of transparent padding around the mark
          will still read smaller within this same box than a tightly-cropped one,
          since nothing here crops or otherwise alters the admin's uploaded image. */}
      <div className="flex min-w-0 flex-col items-center justify-center gap-6 px-6 py-10 text-white sm:py-12 lg:w-1/2 lg:px-12">
        {shownLogo ? (
          <img
            src={shownLogo}
            alt={platformName ?? "Platform logo"}
            className="h-auto max-h-56 w-full max-w-md object-contain lg:max-h-64 lg:max-w-lg"
          />
        ) : (
          <div className="flex items-center gap-3">
            <Star className="h-12 w-12 shrink-0 fill-accent text-accent" aria-hidden="true" />
            <div className="leading-tight">
              <p className="text-3xl font-bold tracking-tight">{platformName ?? "PCTR"}</p>
              <p className="line-clamp-2 max-w-xs text-xs font-medium uppercase tracking-wider text-white/70">
                {platformDescription ?? "Training & Recruitment"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
