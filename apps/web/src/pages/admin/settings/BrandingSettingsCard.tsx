import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import type { UpdateSystemSettingsRequest } from "@internal-training/shared";
import { Card, CardHeader } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { useBranding } from "../../../components/shared/useBranding";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { getSystemSettings, updateSystemSettings } from "../../../services/api/adminSettings";
import { uploadBrandingAsset } from "../../../services/api/media";

type AssetField = "platform_logo_media_id" | "favicon_media_id" | "login_logo_media_id";

/** A locally chosen change not yet saved: `mediaId: null` means "remove the image". */
interface PendingAsset {
  mediaId: string | null;
  previewUrl: string | null;
}

const SETTINGS_KEY = ["admin-settings-general-branding"];
const MAX_BYTES = 2 * 1024 * 1024;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_PRIMARY = "#312C85";
const DEFAULT_ACCENT = "#F5A623";

const LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg"];
const FAVICON_EXTENSIONS = ["png", "ico", "svg", "webp"];

function acceptFor(extensions: string[]): string {
  return extensions.map((extension) => `.${extension}`).join(",");
}

/** One image setting: preview of what's configured, plus Replace/Remove. */
function AssetRow({
  id,
  label,
  hint,
  extensions,
  imageUrl,
  uploading,
  disabled,
  onPick,
  onRemove,
}: {
  id: string;
  label: string;
  hint: string;
  extensions: string[];
  imageUrl: string | null;
  uploading: boolean;
  disabled: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPick(file);
  }

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${label} preview`}
              className="max-h-full max-w-full object-contain p-1"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-300" aria-hidden="true" />
          )}
        </div>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={acceptFor(extensions)}
          className="sr-only"
          disabled={disabled}
          onChange={handleChange}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5 px-3 py-1.5 text-xs"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {uploading ? "Uploading…" : imageUrl ? "Replace" : "Upload"}
          </Button>
          {imageUrl && (
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5 px-3 py-1.5 text-xs"
              disabled={disabled}
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Admin Settings → Branding: platform logo, favicon, login logo, brand + accent colors. */
export function BrandingSettingsCard() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const branding = useBranding();

  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: getSystemSettings });

  // Unsaved edits. `undefined`/`null` drafts mean "untouched" — the saved
  // value is shown, so nothing is copied into state from fetched data.
  const [pending, setPending] = useState<Partial<Record<AssetField, PendingAsset>>>({});
  const [primaryDraft, setPrimaryDraft] = useState<string | null>(null);
  const [accentDraft, setAccentDraft] = useState<string | null>(null);
  const [colorErrors, setColorErrors] = useState<{ primary?: string; accent?: string }>({});

  const previewUrls = useRef<string[]>([]);
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const primaryValue = primaryDraft ?? query.data?.primary_color ?? "";
  const accentValue = accentDraft ?? query.data?.accent_color ?? "";

  const currentUrl: Record<AssetField, string | null> = {
    platform_logo_media_id: branding.logoUrl,
    favicon_media_id: branding.faviconUrl,
    login_logo_media_id: branding.loginLogoUrl,
  };
  const imageFor = (field: AssetField) => {
    const change = pending[field];
    return change ? change.previewUrl : currentUrl[field];
  };

  const uploadMutation = useMutation({
    mutationFn: ({ file }: { field: AssetField; file: File }) => uploadBrandingAsset(file),
    onSuccess: (asset, { field, file }) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.push(previewUrl);
      setPending((current) => ({ ...current, [field]: { mediaId: asset.id, previewUrl } }));
      toast.success("Image uploaded. Save branding to apply it.");
    },
    onError: (error) => {
      const fieldMessage =
        error instanceof ApiClientError ? Object.values(error.fields ?? {})[0]?.[0] : undefined;
      toast.error(
        fieldMessage ??
          (error instanceof ApiClientError ? error.message : "Upload failed. Please try again."),
      );
    },
  });

  const saveMutation = useMutation({
    mutationFn: (input: UpdateSystemSettingsRequest) => updateSystemSettings(input),
    onSuccess: async (result) => {
      queryClient.setQueryData(SETTINGS_KEY, result);
      await queryClient.invalidateQueries({ queryKey: ["public-branding"] });
      setPending({});
      setPrimaryDraft(null);
      setAccentDraft(null);
      toast.success("Branding settings saved.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save branding.");
    },
  });

  const busy = uploadMutation.isPending || saveMutation.isPending;

  function pickFile(field: AssetField, extensions: string[], file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!extensions.includes(extension)) {
      toast.error(
        `Unsupported file type. Use ${extensions.map((e) => e.toUpperCase()).join(", ")}.`,
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That image is too large. The maximum size is 2 MB.");
      return;
    }
    uploadMutation.mutate({ field, file });
  }

  function removeAsset(field: AssetField) {
    setPending((current) => ({ ...current, [field]: { mediaId: null, previewUrl: null } }));
  }

  function save() {
    const errors: { primary?: string; accent?: string } = {};
    if (primaryValue && !HEX_COLOR.test(primaryValue)) {
      errors.primary = "Use a hex color like #312C85.";
    }
    if (accentValue && !HEX_COLOR.test(accentValue)) {
      errors.accent = "Use a hex color like #F5A623.";
    }
    setColorErrors(errors);
    if (errors.primary || errors.accent) return;

    const input: UpdateSystemSettingsRequest = {
      primary_color: primaryValue || null,
      accent_color: accentValue || null,
    };
    for (const field of Object.keys(pending) as AssetField[]) {
      const change = pending[field];
      if (change) input[field] = change.mediaId;
    }
    saveMutation.mutate(input);
  }

  const uploadingField = uploadMutation.isPending
    ? (uploadMutation.variables?.field ?? null)
    : null;

  return (
    <Card flush>
      <CardHeader title="Branding" />
      <div className="p-6">
        <RemoteDataView
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data}
          onRetry={() => void query.refetch()}
        >
          {() => (
            <div className="space-y-6">
              <div className="divide-y divide-slate-100">
                <AssetRow
                  id="branding-platform-logo"
                  label="Platform Logo"
                  hint="Shown in the sidebar everywhere you're signed in, and on the login page too unless you set a separate Login Page Logo below. PNG, JPG, WebP, GIF or SVG · max 2 MB."
                  extensions={LOGO_EXTENSIONS}
                  imageUrl={imageFor("platform_logo_media_id")}
                  uploading={uploadingField === "platform_logo_media_id"}
                  disabled={busy}
                  onPick={(file) => pickFile("platform_logo_media_id", LOGO_EXTENSIONS, file)}
                  onRemove={() => removeAsset("platform_logo_media_id")}
                />
                <AssetRow
                  id="branding-favicon"
                  label="Favicon"
                  hint="Shown in the browser tab. PNG, ICO, SVG or WebP · max 2 MB."
                  extensions={FAVICON_EXTENSIONS}
                  imageUrl={imageFor("favicon_media_id")}
                  uploading={uploadingField === "favicon_media_id"}
                  disabled={busy}
                  onPick={(file) => pickFile("favicon_media_id", FAVICON_EXTENSIONS, file)}
                  onRemove={() => removeAsset("favicon_media_id")}
                />
                <AssetRow
                  id="branding-login-logo"
                  label="Login Page Logo"
                  hint="Optional override for the login/forgot-password/reset-password pages only. Leave unset to use the Platform Logo there too. PNG, JPG, WebP, GIF or SVG · max 2 MB."
                  extensions={LOGO_EXTENSIONS}
                  imageUrl={imageFor("login_logo_media_id")}
                  uploading={uploadingField === "login_logo_media_id"}
                  disabled={busy}
                  onPick={(file) => pickFile("login_logo_media_id", LOGO_EXTENSIONS, file)}
                  onRemove={() => removeAsset("login_logo_media_id")}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
                {(
                  [
                    {
                      key: "primary" as const,
                      label: "Primary Brand Color",
                      id: "branding-primary-color",
                      value: primaryValue,
                      fallback: DEFAULT_PRIMARY,
                      set: setPrimaryDraft,
                    },
                    {
                      key: "accent" as const,
                      label: "Accent Color",
                      id: "branding-accent-color",
                      value: accentValue,
                      fallback: DEFAULT_ACCENT,
                      set: setAccentDraft,
                    },
                  ] as const
                ).map((color) => (
                  <div key={color.key} className="flex items-end gap-3">
                    <input
                      type="color"
                      aria-label={`${color.label} picker`}
                      value={HEX_COLOR.test(color.value) ? color.value : color.fallback}
                      disabled={busy}
                      onChange={(event) => color.set(event.target.value.toUpperCase())}
                      className="mb-0.5 h-10 w-12 shrink-0 cursor-pointer rounded-md border border-slate-300 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="min-w-0 flex-1">
                      <TextField
                        label={color.label}
                        id={color.id}
                        value={color.value}
                        placeholder={color.fallback}
                        disabled={busy}
                        error={colorErrors[color.key]}
                        onChange={(event) => color.set(event.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="mb-0.5 shrink-0 gap-1.5 px-2 py-2 text-xs"
                      disabled={busy || !color.value}
                      onClick={() => color.set("")}
                      title="Use the default color"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only sm:not-sr-only">Default</span>
                    </Button>
                  </div>
                ))}
              </div>
              <p className="-mt-2 text-xs text-slate-500">
                Leave a color empty to keep the built-in PCTR color. Uploaded images and colors
                apply after you save.
              </p>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <Button type="button" disabled={busy} onClick={save}>
                  {saveMutation.isPending ? "Saving…" : "Save Branding"}
                </Button>
              </div>
            </div>
          )}
        </RemoteDataView>
      </div>
    </Card>
  );
}
