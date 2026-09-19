import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { TextField, TextAreaField, SelectField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { getSystemSettings, updateSystemSettings } from "../../../services/api/adminSettings";

// Local form shape: every input is a string ("" = not configured, saved as
// null so the built-in PCTR default applies) — same approach as
// AdminSettingsPage.tsx's own local schema.
const generalFormSchema = z.object({
  platform_name: z.string().trim().max(100, "Keep it under 100 characters."),
  platform_description: z.string().trim().max(500, "Keep it under 500 characters."),
  support_email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      message: "Enter a valid email address.",
    }),
  timezone: z.string(),
  browser_title: z.string().trim().max(100, "Keep it under 100 characters."),
});
type GeneralFormValues = z.infer<typeof generalFormSchema>;
type GeneralField = keyof GeneralFormValues;

function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  return intl.supportedValuesOf?.("timeZone") ?? ["UTC"];
}

/** Admin Settings → General: platform name/description, support email, timezone, browser title. */
export function GeneralSettingsCard() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const query = useQuery({
    queryKey: ["admin-settings-general-branding"],
    queryFn: getSystemSettings,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GeneralFormValues>({
    resolver: zodResolver(generalFormSchema),
    defaultValues: {
      platform_name: "",
      platform_description: "",
      support_email: "",
      timezone: "",
      browser_title: "",
    },
  });

  useEffect(() => {
    if (!query.data) return;
    reset({
      platform_name: query.data.platform_name ?? "",
      platform_description: query.data.platform_description ?? "",
      support_email: query.data.support_email ?? "",
      timezone: query.data.timezone ?? "",
      browser_title: query.data.browser_title ?? "",
    });
  }, [query.data, reset]);

  const timeZones = useMemo(() => {
    const zones = listTimeZones();
    const saved = query.data?.timezone;
    return saved && !zones.includes(saved) ? [saved, ...zones] : zones;
  }, [query.data?.timezone]);

  const mutation = useMutation({
    mutationFn: (values: GeneralFormValues) =>
      updateSystemSettings({
        platform_name: values.platform_name || null,
        platform_description: values.platform_description || null,
        support_email: values.support_email || null,
        timezone: values.timezone || null,
        browser_title: values.browser_title || null,
      }),
    onSuccess: async (result) => {
      queryClient.setQueryData(["admin-settings-general-branding"], result);
      await queryClient.invalidateQueries({ queryKey: ["public-branding"] });
      toast.success("General settings saved.");
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as GeneralField, { message: messages[0] });
        }
        return;
      }
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save settings.");
    },
  });

  return (
    <Card flush>
      <CardHeader title="General" />
      <div className="p-6">
        <RemoteDataView
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data}
          onRetry={() => void query.refetch()}
        >
          {() => (
            <form
              className="space-y-4"
              onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Platform Name"
                  id="general-platform-name"
                  placeholder="PCTR Training Platform"
                  error={errors.platform_name?.message}
                  {...register("platform_name")}
                />
                <TextField
                  label="Browser / Page Title"
                  id="general-browser-title"
                  placeholder="Shown in the browser tab"
                  error={errors.browser_title?.message}
                  {...register("browser_title")}
                />
              </div>
              <TextAreaField
                label="Platform Description"
                id="general-platform-description"
                placeholder="A short description of the training portal."
                error={errors.platform_description?.message}
                {...register("platform_description")}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Support Email"
                  id="general-support-email"
                  type="email"
                  placeholder="support@example.com"
                  error={errors.support_email?.message}
                  {...register("support_email")}
                />
                <SelectField
                  label="Timezone"
                  id="general-timezone"
                  error={errors.timezone?.message}
                  {...register("timezone")}
                >
                  <option value="">Not set (use each user&apos;s browser timezone)</option>
                  {timeZones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </SelectField>
              </div>
              <p className="text-xs text-slate-500">
                Leave a field empty to use the built-in PCTR default.
              </p>
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                  {mutation.isPending ? "Saving…" : "Save General Settings"}
                </Button>
              </div>
            </form>
          )}
        </RemoteDataView>
      </div>
    </Card>
  );
}
