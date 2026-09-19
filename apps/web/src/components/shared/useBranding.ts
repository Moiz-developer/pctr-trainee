import { createContext, useContext } from "react";

/**
 * Resolved platform branding. `null` means "not configured" — callers fall
 * back to the built-in PCTR defaults, so the app works with no settings saved.
 */
export interface Branding {
  platformName: string | null;
  platformDescription: string | null;
  supportEmail: string | null;
  logoUrl: string | null;
  loginLogoUrl: string | null;
  faviconUrl: string | null;
}

export const EMPTY_BRANDING: Branding = {
  platformName: null,
  platformDescription: null,
  supportEmail: null,
  logoUrl: null,
  loginLogoUrl: null,
  faviconUrl: null,
};

export const BrandingContext = createContext<Branding>(EMPTY_BRANDING);

export function useBranding(): Branding {
  return useContext(BrandingContext);
}
