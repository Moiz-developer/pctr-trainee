import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, CheckCircle2, Download, Pencil, Plus, ScrollText } from "lucide-react";
import type { PolicyVersionResponse } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { getMediaAccessUrl } from "../../../services/api/media";
import {
  activatePolicyVersion,
  archivePolicyVersion,
  getAdminPolicy,
} from "../../../services/api/adminPolicies";
import { PolicyFormModal } from "./PolicyFormModal";
import { PolicyVersionFormModal } from "./PolicyVersionFormModal";
import { PolicyDepartmentsPanel } from "./PolicyDepartmentsPanel";

function versionStatus(version: PolicyVersionResponse): { label: string; tone: BadgeTone } {
  if (version.is_active) return { label: "Active", tone: "success" };
  if (version.is_archived) return { label: "Archived", tone: "neutral" };
  return { label: "Draft", tone: "warning" };
}

function VersionDocumentButton({ version }: { version: PolicyVersionResponse }) {
  const mutation = useMutation({
    mutationFn: () => getMediaAccessUrl(version.media_asset_id!),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener"),
  });

  if (!version.media_asset_id) return <span className="text-xs text-slate-400">No document</span>;

  return (
    <Button
      variant="ghost"
      className="gap-1.5 px-2 py-1 text-xs"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      {mutation.isPending ? "Opening…" : "View"}
    </Button>
  );
}

/**
 * Admin Policy detail — the policy's own metadata plus its FULL version
 * history, active/archived/draft alike (SYSTEM_PLAN.md §14.8/§23, Phase
 * 5.2: "admins can browse full history including archived versions").
 * Activation (permission `policy.version.activate`) is a one-click action
 * per non-active row, mirroring AdminQueriesPage's own
 * status-as-one-click-action convention — never bundled into the version
 * edit form.
 */
export function AdminPolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editPolicyOpen, setEditPolicyOpen] = useState(false);
  const [versionModal, setVersionModal] = useState<
    { mode: "create" } | { mode: "edit"; version: PolicyVersionResponse } | null
  >(null);

  const detailQuery = useQuery({
    queryKey: ["admin-policy", id],
    queryFn: () => getAdminPolicy(id!),
    enabled: !!id,
  });

  const activateMutation = useMutation({
    mutationFn: (versionId: string) => activatePolicyVersion(id!, versionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-policy", id] });
      await queryClient.invalidateQueries({ queryKey: ["admin-policies"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (versionId: string) => archivePolicyVersion(id!, versionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-policy", id] });
      await queryClient.invalidateQueries({ queryKey: ["admin-policies"] });
    },
  });

  if (!id) return null;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => void navigate("/admin/policies")}
        className="flex cursor-pointer items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Policies
      </button>

      <RemoteDataView
        isLoading={detailQuery.isLoading}
        isError={detailQuery.isError}
        error={detailQuery.error}
        data={detailQuery.data}
        onRetry={() => void detailQuery.refetch()}
      >
        {(detail) => (
          <>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-slate-400" aria-hidden="true" />
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{detail.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Slug: {detail.slug} {detail.category && `· ${detail.category}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => setEditPolicyOpen(true)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit
                </Button>
              </div>
              {detail.description && (
                <p className="mt-3 text-sm text-slate-700">{detail.description}</p>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Versions</h3>
                <Button
                  className="gap-1.5"
                  onClick={() => setVersionModal({ mode: "create" })}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  New Version
                </Button>
              </div>

              {activateMutation.isError && (
                <p className="mt-3 text-sm text-red-600">Failed to activate that version.</p>
              )}
              {archiveMutation.isError && (
                <p className="mt-3 text-sm text-red-600">Failed to archive that version.</p>
              )}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">Version</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Effective Date</th>
                      <th className="py-2 pr-4">Updated</th>
                      <th className="py-2 pr-4">Document</th>
                      <th className="py-2 pr-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {detail.versions.map((version) => {
                      const status = versionStatus(version);
                      return (
                        <tr key={version.id} className="border-b border-slate-50">
                          <td className="py-3 pr-4 font-medium text-slate-900">
                            {version.version_label}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge tone={status.tone}>{status.label}</Badge>
                          </td>
                          <td className="py-3 pr-4 text-slate-500">
                            {new Date(version.effective_date).toLocaleDateString()}
                          </td>
                          <td className="py-3 pr-4 text-slate-500">
                            {new Date(version.updated_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 pr-4">
                            <VersionDocumentButton version={version} />
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                className="gap-1.5 px-2 py-1 text-xs"
                                onClick={() => setVersionModal({ mode: "edit", version })}
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                Edit
                              </Button>
                              {!version.is_active && (
                                <Button
                                  variant="secondary"
                                  className="gap-1.5 px-2 py-1 text-xs"
                                  disabled={
                                    activateMutation.isPending &&
                                    activateMutation.variables === version.id
                                  }
                                  onClick={() => activateMutation.mutate(version.id)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Activate
                                </Button>
                              )}
                              {version.is_active && (
                                <Button
                                  variant="secondary"
                                  className="gap-1.5 px-2 py-1 text-xs"
                                  disabled={
                                    archiveMutation.isPending &&
                                    archiveMutation.variables === version.id
                                  }
                                  onClick={() => archiveMutation.mutate(version.id)}
                                >
                                  <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                                  Archive
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {detail.versions.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-500">
                    No versions yet. Create one, then activate it to make it visible to trainers.
                  </p>
                )}
              </div>
            </Card>

            <PolicyDepartmentsPanel policyId={detail.id} />
          </>
        )}
      </RemoteDataView>

      {detailQuery.data && (
        <>
          <PolicyFormModal
            open={editPolicyOpen}
            onClose={() => setEditPolicyOpen(false)}
            policy={detailQuery.data}
            onSuccess={() => setEditPolicyOpen(false)}
          />
          <PolicyVersionFormModal
            open={versionModal !== null}
            onClose={() => setVersionModal(null)}
            policyId={id}
            version={versionModal?.mode === "edit" ? versionModal.version : undefined}
            onSuccess={() => setVersionModal(null)}
          />
        </>
      )}
    </div>
  );
}
