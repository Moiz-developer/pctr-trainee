import { GeneralSettingsCard } from "./GeneralSettingsCard";
import { BrandingSettingsCard } from "./BrandingSettingsCard";
import { AdminSettingsPage } from "./AdminSettingsPage";

/**
 * Admin Settings (permission `system.manage`): General + Branding at the top,
 * followed by the existing System Settings (media limits, signed-URL TTLs,
 * video completion threshold — AdminSettingsPage.tsx, unchanged). All three
 * persist to the same single-row `system_settings` table via
 * `PATCH /admin/settings`.
 */
export function AdminSettingsOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          Platform information, branding and system limits.
        </p>
      </div>
      <GeneralSettingsCard />
      <BrandingSettingsCard />
      <AdminSettingsPage />
    </div>
  );
}
