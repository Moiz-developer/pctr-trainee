import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, KeyRound, Pencil, Plus, Tags } from "lucide-react";
import type { ResourceResponse, ResourceStatus } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { SelectField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { Can } from "../../../authorization/Can";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { listAdminResources, updateResource } from "../../../services/api/adminResources";
import { listActiveResourceCategories } from "../../../services/api/resourceCategories";
import { ResourceFormModal } from "./ResourceFormModal";
import { ResourceAccessModal } from "./ResourceAccessModal";

const STATUS_TONE: Record<ResourceStatus, BadgeTone> = {
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

/**
 * Admin Resource Library management (SYSTEM_PLAN.md §14.5/§20/§26, Phase
 * 5.1, permission `resource.manage` — enforced server-side; this page has
 * no client-side permission gate of its own since `/admin/*` already
 * requires an admin-tier permission, and the API is the authoritative
 * check, §10). Every resource, filterable by status/category — mirrors
 * AdminQueriesPage.tsx's table+filters shape. "Delete" is the project-wide
 * archive-not-hard-delete convention (§13): the Archive/Publish button is a
 * one-click `status` toggle, same reasoning as CourseCategoriesPage.tsx's
 * Activate/Deactivate.
 */
export function AdminResourcesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ResourceStatus | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceResponse | null>(null);
  const [managingAccess, setManagingAccess] = useState<ResourceResponse | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<ResourceResponse | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["active-resource-categories"],
    queryFn: listActiveResourceCategories,
  });

  const query = useQuery({
    queryKey: ["admin-resources", page, status, categoryId],
    queryFn: () =>
      listAdminResources({
        page,
        pageSize: 20,
        status: status || undefined,
        category_id: categoryId || undefined,
      }),
  });

  const toggleStatus = useMutation({
    mutationFn: (target: ResourceResponse) =>
      updateResource(target.id, {
        status: target.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED",
      }),
    onSuccess: async (_data, target) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      setConfirmArchive(null);
      toast.success(target.status === "PUBLISHED" ? "Resource archived." : "Resource published.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Something went wrong.");
    },
  });

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }
  const handleStatusChange = resetToFirstPage(setStatus);
  const handleCategoryChange = resetToFirstPage(setCategoryId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Resources</h2>
          <p className="mt-1 text-sm text-slate-500">
            Reference documents and files available to trainers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => void navigate("/admin/resources/categories")}
          >
            <Tags className="h-4 w-4" aria-hidden="true" />
            Manage Categories
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Resource
          </Button>
        </div>
      </div>

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Status"
            id="filter-status"
            value={status}
            onChange={(event) => handleStatusChange(event.target.value as ResourceStatus | "")}
          >
            <option value="">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </SelectField>
          <SelectField
            label="Category"
            id="filter-category"
            value={categoryId}
            onChange={(event) => handleCategoryChange(event.target.value)}
          >
            <option value="">All categories</option>
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
        </div>

        <RemoteDataView
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data?.data}
          onRetry={() => void query.refetch()}
          isEmpty={(items) => items.length === 0}
          emptyTitle="No resources match these filters"
          emptyDescription="Try clearing a filter, or create a new resource."
        >
          {(items) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">File Type</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Uploaded</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="max-w-xs py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <FileText
                            className="h-3.5 w-3.5 shrink-0 text-slate-400"
                            aria-hidden="true"
                          />
                          <span className="truncate font-medium text-slate-900">{item.title}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{item.category.name}</td>
                      <td className="py-3 pr-4 text-slate-500">{item.file_type}</td>
                      <td className="py-3 pr-4">
                        <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            className="gap-1.5 px-2 py-1 text-xs"
                            onClick={() => setEditing(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Edit
                          </Button>
                          <Can permission="resource.manage">
                            <Button
                              variant="ghost"
                              className="gap-1.5 px-2 py-1 text-xs"
                              onClick={() => setManagingAccess(item)}
                            >
                              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                              Access
                            </Button>
                          </Can>
                          <Button
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            disabled={
                              toggleStatus.isPending && toggleStatus.variables?.id === item.id
                            }
                            onClick={() =>
                              item.status === "PUBLISHED"
                                ? setConfirmArchive(item)
                                : toggleStatus.mutate(item)
                            }
                          >
                            {item.status === "PUBLISHED" ? "Archive" : "Publish"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </RemoteDataView>

        {query.data && query.data.meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">
              Page {query.data.meta.page} of {query.data.meta.totalPages} ·{" "}
              {query.data.meta.totalItems} total
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="gap-1 px-2 py-1 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-1 px-2 py-1 text-xs"
                disabled={page >= query.data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ResourceFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => setCreateOpen(false)}
      />
      <ResourceFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        resource={editing ?? undefined}
        onSuccess={() => setEditing(null)}
      />
      {managingAccess && (
        <ResourceAccessModal
          open={!!managingAccess}
          onClose={() => setManagingAccess(null)}
          resourceId={managingAccess.id}
          resourceTitle={managingAccess.title}
        />
      )}
      <ConfirmDialog
        open={!!confirmArchive}
        title="Archive resource"
        description={`"${confirmArchive?.title ?? ""}" will no longer be visible to trainees. You can publish it again later.`}
        confirmLabel="Archive"
        isPending={toggleStatus.isPending}
        onConfirm={() => confirmArchive && toggleStatus.mutate(confirmArchive)}
        onCancel={() => setConfirmArchive(null)}
      />
    </div>
  );
}
