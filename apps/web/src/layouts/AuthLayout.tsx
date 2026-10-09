import type { ReactNode } from "react";
import { useBranding } from "../components/shared/useBranding";

/**
 * Layout for unauthenticated routes (SYSTEM_PLAN.md §27 layouts/ "AuthLayout") —
 * used by Login, Forgot Password and Reset Password alike (App.tsx), so a change
 * here applies to all three consistently.
 *
 * Breakpoint is `md` (768px). Desktop (>=768px): a full-height split — a purple
 * panel on the left (55%) holds the logo and the form directly on the gradient
 * (no card chrome), and a corporate photo fills the right panel (45%), cut by a
 * CSS diagonal at its top-left corner and carrying a bottom caption bar. The row
 * is capped at max-w-[1400px] and centered above that width; below it, the row
 * is simply `w-full` (fluid) — one rule covers both states. The gradient on the
 * OUTER wrapper spans the full viewport at any width, including the gutters
 * either side of a centered >1400px row, and is what's visible through the
 * photo panel's clipped corner.
 *
 * Mobile/tablet (<768px): a compact logo header above the form (not the photo
 * panel, which only renders at `md:flex` — "hide/substantially simplify the
 * large photograph on smaller screens") so there's no large empty/heavy section
 * competing with the form on a small screen, and never two logos at once.
 */
const DEFAULT_AUTH_LOGO_SRC = "/brand/excellium-logo-white.png";
const AUTH_PHOTO_SRC = "/brand/auth-corporate-photo.jpg";

/**
 * The logo, sized for its slot. A custom Login Page Logo (admin-uploaded, Admin
 * Settings -> Branding) is shown exactly as uploaded, but wrapped in a light
 * backdrop chip — its colors are unknown and this panel is dark, so (same
 * reasoning as the sidebar's own logo work) a safety backdrop avoids an
 * invisible logo without altering the admin's file. The built-in default is
 * `excellium-logo-white.png` — a white-lettering variant derived from the
 * existing dark-text asset (dark "ink" pixels recolored to white, the purple
 * diamond accents left untouched) specifically because the original dark-text
 * default is illegible on this dark panel; it renders directly, no chip needed,
 * matching the reference design.
 */
function AuthLogo({ src, alt, hasCustomLogo, className }: {
  src: string;
  alt: string;
  hasCustomLogo: boolean;
  className: string;
}) {
  if (hasCustomLogo) {
    return (
      <div className="inline-block rounded-lg bg-white/95 px-4 py-2.5">
        <img src={src} alt={alt} className={className} />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} />;
}

export function AuthLayout({ children }: { children: ReactNode }) {
  const { platformName, loginLogoUrl } = useBranding();
  // Login Page Logo (Admin Settings -> Branding) is an optional override just for
  // these unauthenticated pages; when the admin hasn't set one, the white-text
  // default above is shown instead — NOT the Platform Logo (that's the signed-in
  // sidebar's own fallback, a separate setting this page never reads).
  const hasCustomLogo = loginLogoUrl != null;
  const logoSrc = loginLogoUrl ?? DEFAULT_AUTH_LOGO_SRC;
  const logoAlt = platformName ?? "Platform logo";

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-700">
      {/* Mobile/tablet-only compact logo header (hidden at md+, where the in-panel logo
          below takes over) — exactly one logo renders at any width, never both. */}
      <div className="flex shrink-0 items-center justify-center px-6 py-5 md:hidden">
        <AuthLogo
          src={logoSrc}
          alt={logoAlt}
          hasCustomLogo={hasCustomLogo}
          className="h-auto max-h-9 w-auto max-w-[190px] object-contain"
        />
      </div>

      {/* The two-panel row — fluid below/at 1400px, centered and capped above it. */}
      <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-1 flex-col md:flex-row">
        {/* Left panel — the purple gradient IS the form's background (no card). min-w-0
            keeps this flex item free to shrink; `md:flex-none` (paired with the explicit
            `md:w-[55%]`) is required because `flex-1`'s `flex-basis: 0%` otherwise ignores
            any width utility and both panels split evenly instead of 55/45 — verified
            behavior, not a hypothetical (see this unit's own breakpoint verification). */}
        <div className="relative flex min-w-0 flex-1 flex-col justify-center overflow-hidden px-6 py-12 md:w-[55%] md:flex-none md:px-16 md:py-16">
          {/* Subtle decorative geometry, top-left — plain rotated/translucent panels, no
              image asset. Purely decorative (aria-hidden), clipped by the parent's own
              overflow-hidden so nothing escapes the panel bounds at any viewport width. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-20 h-72 w-72 -rotate-12 rounded-[2rem] bg-white/5" />
            <div className="absolute -top-8 -left-32 h-56 w-72 -rotate-12 rounded-[2rem] bg-white/5" />
          </div>

          <div className="relative mx-auto w-full max-w-[420px]">
            {/* In-panel logo — desktop/tablet only; the mobile header above covers
                everything below md, so this and the header are mutually exclusive. */}
            <div className="mb-8 hidden md:block">
              <AuthLogo
                src={logoSrc}
                alt={logoAlt}
                hasCustomLogo={hasCustomLogo}
                className="h-auto max-h-10 w-auto max-w-[220px] object-contain"
              />
            </div>
            {children}
          </div>
        </div>

        {/* Right panel — the corporate photograph, desktop/tablet-landscape only ("hide
            or substantially simplify ... on smaller screens"). The clip-path cuts a
            diagonal off this panel's own top-left corner; the outer wrapper's gradient
            (not a second copy of it) shows through that cut, so the purple panel's edge
            reads as diagonal without needing the two panels to overlap or any extra
            element. object-cover + object-right-ish positioning keeps the photo's subject
            (framed toward the right of the source image) in frame despite this panel
            being much taller/narrower than the source photo's own aspect ratio. */}
        <div
          className="relative hidden min-w-0 flex-1 overflow-hidden md:block md:w-[45%] md:flex-none"
          style={{ clipPath: "polygon(65px 0, 100% 0, 100% 100%, 0 100%)" }}
        >
          <img
            src={AUTH_PHOTO_SRC}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-[78%_center]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-indigo-950/75 px-6 py-4">
            <p className="text-sm font-medium text-white">
              Helping Thousands across the UK transition into Professional Careers
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
