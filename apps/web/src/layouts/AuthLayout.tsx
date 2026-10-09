import type { ReactNode } from "react";
import { useBranding } from "../components/shared/useBranding";

/**
 * Layout for unauthenticated routes (SYSTEM_PLAN.md §27 layouts/ "AuthLayout") —
 * used by Login, Forgot Password and Reset Password alike (App.tsx), so a change
 * here applies to all three consistently.
 *
 * Breakpoint is `md` (768px). Desktop (>=768px): a full-height 50/50 split — a
 * purple panel on the left holds the logo and the form directly on the gradient
 * (no card chrome), and a corporate photo fills the right panel, cut by a CSS
 * diagonal at its top-left corner and carrying a bottom caption bar. The row
 * is always `w-full` — edge-to-edge at every viewport width, no max-width cap or
 * centering (confirmed against the client's reference, captured at 1920px with
 * zero outer gutter).
 *
 * Mobile/tablet (<768px): a large left-aligned logo above the form (not the photo
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
      {/* The two-panel row — always edge-to-edge, no max-width cap at any viewport. */}
      <div className="flex w-full min-w-0 flex-1 flex-col md:flex-row">
        {/* Left panel — the purple gradient IS the form's background (no card). min-w-0
            keeps this flex item free to shrink; `md:flex-none` (paired with the explicit
            `md:w-1/2`) is required because `flex-1`'s `flex-basis: 0%` otherwise ignores
            any width utility and would make both panels compete for space based on
            content instead of each taking exactly half — verified behavior, not a
            hypothetical (see this unit's own breakpoint verification). */}
        <div className="relative flex min-w-0 flex-1 flex-col justify-start overflow-hidden bg-[url('/brand/rotate-auth.webp')] bg-contain bg-left-top bg-no-repeat px-6 py-12 max-md:min-h-svh max-md:gap-[clamp(1.75rem,4svh,2.5rem)] max-md:bg-[length:100%_auto] max-md:px-[clamp(1rem,4vw,1.5rem)] max-md:pt-[clamp(1rem,2svh,1.5rem)] max-md:pb-[clamp(1.5rem,4svh,2.5rem)] md:w-1/2 md:flex-none md:pb-16 md:pr-16 md:pt-[clamp(4rem,17vh,10rem)] md:pl-[8.452vw]">
          {/* Mobile logo shares the form's left edge and decorative background.
              Its natural aspect ratio also keeps admin-uploaded logos intact. */}
          <div className="flex shrink-0 items-start [&>div]:min-w-0 [&>div]:max-w-full md:hidden">
            <AuthLogo
              src={logoSrc}
              alt={logoAlt}
              hasCustomLogo={hasCustomLogo}
              className="h-auto max-h-28 w-auto max-w-full object-contain max-md:w-[min(100%,21.875rem)]"
            />
          </div>
          {/* Decorative background image (rotate-auth.webp), not an absolutely positioned
              <img> — bg-contain scales it to the largest size that fits the panel's own
              box while preserving its aspect ratio (never stretched/cropped), bg-left-top
              anchors it to the panel's exact top-left corner (background-position is
              relative to the padding box by default, which — with no border — IS the
              panel's outer edge), and bg-no-repeat stops it tiling. No bg-color is set
              here deliberately: the reference's own CSS pairs this with a flat #211869
              fallback, but this panel already shows the approved from-indigo-950 →
              indigo-700 gradient (on the outer wrapper, behind everything) through
              wherever the webp's own built-in transparency doesn't cover — adding an
              opaque background-color here would paint over and flatten that gradient.
              No extra opacity utility either: the asset already carries its own ~27% max
              alpha, confirmed via canvas pixel inspection (see AUTH_PHOTO_SRC/original
              <img> history), so adding more would double-dampen an already-faint asset.
              A CSS background is inherently behind this element's own children (the logo/
              heading/form/footer render after it in normal content, no z-index needed),
              and the panel's own overflow-hidden still clips it from escaping at any
              viewport width.
              md:pl-[8.452vw] (not a fixed px value, and no more `2xl:` breakpoint jump) —
              pixel-measured directly off reference-auth.jpeg: its form content starts at
              x=119px at the image's native 1408px width (119/1408 = 8.452%), so the same
              percentage reproduces that exact offset at 1408px and scales continuously —
              no discontinuity — at every other width, instead of jumping between two
              fixed values at a single breakpoint.

              justify-start (base, not just `md:`) + md:pt-[clamp(4rem,17vh,10rem)] — pure
              vertical centering (the previous base `justify-center`) was the real cause of
              two separate "excessive space" bugs: on a real, taller desktop browser window,
              centering distributes ALL of a tall viewport's extra height as growing top/
              bottom margins, so the top gap balloons well past what the reference ever
              shows; and on mobile specifically, centering the (short) form within this
              panel's full height — against the min-h-screen outer wrapper — produced a
              measured 151px gap between the mobile logo header and the heading (pixel-
              compared against mobile-auth.png's equivalent ~39px gap), which is the
              "excessive spacing" the mobile reference flagged. justify-start fixes both by
              anchoring content to the top everywhere; md:pt-[clamp(4rem,17vh,10rem)] (17vh
              = 119/695, the reference's own top-gap ratio) then adds back the desktop-only
              top offset on top of that, scoped to md+ so it doesn't reintroduce the mobile
              gap. Mobile now uses its own viewport-aware padding and logo gap. */}
          {/* max-w-[clamp(29.5rem,33.52vw,40rem)] (29.5rem = 472px, the reference's own
              measured width at its native 1408px) — not a fixed 472px ceiling. 33.52vw is
              472/1408, the reference's own content-width-to-viewport ratio, so the column
              keeps the SAME proportion of the panel at every width above 1408px instead of
              staying pinned at 472px while the panel around it keeps growing (which is what
              made the form look proportionally smaller/lost on wide screens). The 40rem
              (640px) ceiling is a sane cap for ultra-wide monitors only — it isn't reached
              before roughly 1909px, so it doesn't affect any of the verified widths below. */}
          <div className="relative w-full max-w-[clamp(29.5rem,33.52vw,40rem)] max-md:flex max-md:flex-1 max-md:flex-col">
            {/* In-panel logo — desktop/tablet only; the mobile header above covers
                everything below md, so this and the header are mutually exclusive.
                max-h-[clamp(4rem,4.545vw,6rem)] (not a fixed max-h-16/64px) — 4.545vw is
                64/1408, the reference's own logo-height-to-viewport ratio at 1408px, so the
                logo grows in the same proportion as the column above instead of staying a
                fixed 64px while its surrounding panel keeps growing. max-w-[400px] is a
                ceiling only (the asset's own aspect ratio, via object-contain, derives the
                actual width from the height) — generous enough to never bind at any height
                this clamp can produce. */}
            <div className="mb-8 hidden md:block">
              <AuthLogo
                src={logoSrc}
                alt={logoAlt}
                hasCustomLogo={hasCustomLogo}
                className="h-auto max-h-[clamp(4rem,4.545vw,6rem)] w-auto max-w-[400px] object-contain"
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
            element. object-cover + object-[100%_center] (full-right anchor, not the
            previous 78%) keeps the photo's subject anchored to the panel's right edge
            at every desktop width, despite this panel being much taller/narrower than
            the source photo's own aspect ratio. */}
        <div
          className="relative hidden min-w-0 flex-1 overflow-hidden md:block md:w-1/2 md:flex-none"
          style={{ clipPath: "polygon(65px 0, 100% 0, 100% 100%, 0 100%)" }}
        >
          <img
            src={AUTH_PHOTO_SRC}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-[100%_center]"
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
