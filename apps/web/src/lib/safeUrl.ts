/**
 * Render-time guard for admin-authored external links (lesson/resource
 * `external_url`). The API now only accepts HTTPS, but legacy rows and any
 * future bypass must never reach `href`/`window.open` with a scheme like
 * `javascript:` or `data:` — so only `https:` URLs are ever returned.
 */
export function getSafeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
