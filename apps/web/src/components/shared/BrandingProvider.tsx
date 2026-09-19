import { useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicBranding } from "../../services/api/branding";
import { BrandingContext, EMPTY_BRANDING, type Branding } from "./useBranding";

const DEFAULT_TITLE = document.title;

/**
 * Loads the saved platform branding (public endpoint — works on the login
 * page) and applies it: browser title, favicon and the brand/accent colors
 * (by overriding the theme CSS variables in index.css). Anything not
 * configured — or a failed request — leaves the built-in PCTR defaults in
 * place, so branding can never block the app from rendering.
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["public-branding"],
    queryFn: getPublicBranding,
    staleTime: 30 * 60_000, // logo URLs are signed for 1h server-side
    retry: 1,
  });
  const data = query.data;

  const branding = useMemo<Branding>(
    () =>
      data
        ? {
            platformName: data.platform_name,
            platformDescription: data.platform_description,
            supportEmail: data.support_email,
            logoUrl: data.logo_url,
            loginLogoUrl: data.login_logo_url,
            faviconUrl: data.favicon_url,
          }
        : EMPTY_BRANDING,
    [data],
  );

  useEffect(() => {
    document.title = data?.browser_title ?? data?.platform_name ?? DEFAULT_TITLE;
  }, [data?.browser_title, data?.platform_name]);

  useEffect(() => {
    if (!data?.favicon_url) return;
    const existing = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    const link = existing ?? document.createElement("link");
    if (!existing) {
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const previousHref = link.getAttribute("href");
    link.removeAttribute("type");
    link.href = data.favicon_url;
    return () => {
      if (!existing) link.remove();
      else if (previousHref) link.setAttribute("href", previousHref);
    };
  }, [data?.favicon_url]);

  useEffect(() => {
    const root = document.documentElement;
    const primary = data?.primary_color;
    const accent = data?.accent_color;
    if (primary) {
      root.style.setProperty("--color-indigo-900", primary);
      root.style.setProperty("--color-indigo-800", `color-mix(in srgb, ${primary} 85%, white)`);
      root.style.setProperty("--color-indigo-950", `color-mix(in srgb, ${primary} 65%, black)`);
    }
    if (accent) root.style.setProperty("--color-accent", accent);
    return () => {
      for (const name of [
        "--color-indigo-900",
        "--color-indigo-800",
        "--color-indigo-950",
        "--color-accent",
      ]) {
        root.style.removeProperty(name);
      }
    };
  }, [data?.primary_color, data?.accent_color]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}
