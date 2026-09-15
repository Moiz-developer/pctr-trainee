import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, KeyRound, Megaphone, Pencil, Plus } from "lucide-react";
import type { AdminAnnouncementResponse, AnnouncementPriority, AnnouncementStatus } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { SelectField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { Can } from "../../../authorization/Can";
import { ApiClientError } from "../../../services/api/client";
import {
  archiveAnnouncement,
  listAdminAnnouncements,
  publishAnnouncement,
} from "../../../services/api/adminAnnouncements";
import { AnnouncementFormModal } from "./AnnouncementFormModal";
import { AnnouncementAccessModal } from "./AnnouncementAccessModal";

const STATUS_TONE: Record<AnnouncementStatus, BadgeTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

const PRIORITY_TONE: Record<AnnouncementPriority, BadgeTone> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "danger",
};

/**
 * Admin Announcement management (SYSTEM_PLAN.md §14.6/§21/§26, Phase 5.3.2,
 * permission `announcement.manage` or `announcement.publish` for reads —
 * enforced server-side; this page has no client-side permission gate of
 * its own since `/admin/*` already requires an admin-tier permission,
 * §10). Every announcement, filterable by status/priority — mirrors
 * AdminResourcesPage.tsx's table+filters shape. Publish/Archive are
 * one-click list-row actions (server-validated lifecycle transitions,
 * §14.6/§21) — never bundled into the edit form, matching
 * AdminQueriesPage's/AdminPolicyDetailPage's identical "status change is a
 * dedicated action" convention.
 */
export function AdminAnnouncementsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AnnouncementStatus | "">("");
  const [priority, setPriority] = useState<AnnouncementPriority | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAnnouncementResponse | null>(null);
  const [managingAccess, setManagingAccess] = useState<AdminAnnouncementResponse | null>(null);

  const query = useQuery({
    queryKey: ["admin-announcements", page, status, priority],
    queryFn: () =>
      listAdminAnnouncements({
        page,
        pageSize: 20,
        status: status || undefined,
        priority: priority || undefined,
      }),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishAnnouncement(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveAnnouncement(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
  });
  const lifecycleError =
    publishMutation.error instanceof ApiClientError
      ? publishMutation.error.message
      : archiveMutation.error instanceof ApiClientError
        ? archiveMutation.error.message
        : null;

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }
  const handleStatusChange = resetToFirstPage(setStatus);
  const handlePriorityChange = resetToFirstPage(setPriority);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Announcements</h2>
          <p className="mt-1 text-sm text-slate-500">
            Publish company-wide or department-targeted news.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Announcement
        </Button>
      </div>

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Status"
            id="filter-status"
            value={status}
            onChange={(event) => handleStatusChange(event.target.value as AnnouncementStatus | "")}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </SelectField>
          <SelectField
            label="Priority"
            id="filter-priority"
            value={priority}
            onChange={(event) => handlePriorityChange(event.target.value as AnnouncementPriority | "")}
          >
            <option value="">All priorities</option>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </SelectField>
        </div>

        {lifecycleError && <p className="mb-3 text-sm text-red-600">{lifecycleError}</p>}

        <RemoteDataView
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data?.data}
          onRetry={() => void query.refetch()}
          isEmpty={(items) => items.length === 0}
          emptyTitle="No announcements match these filters"
          emptyDescription="Try clearing a filter, or create a new announcement."
        >
          {(items) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Author</th>
                    <th className="py-2 pr-4">Priority</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Published</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="max-w-xs py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <Megaphone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="truncate font-medium text-slate-900">{item.title}</span>
                          {item.is_important && <Badge tone="danger">Important</Badge>}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{item.author_full_name ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {item.published_at ? new Date(item.published_at).toLocaleDateString() : "—"}
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
                          <Can permission="announcement.manage">
                            <Button
                              variant="ghost"
                              className="gap-1.5 px-2 py-1 text-xs"
                              onClick={() => setManagingAccess(item)}
                            >
                              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                              Access
                            </Button>
                          </Can>
                          {item.status === "DRAFT" && (
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={publishMutation.isPending && publishMutation.variables === item.id}
                              onClick={() => publishMutation.mutate(item.id)}
                            >
                              Publish
                            </Button>
                          )}
                          {item.status !== "ARCHIVED" && (
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={archiveMutation.isPending && archiveMutation.variables === item.id}
                              onClick={() => archiveMutation.mutate(item.id)}
                            >
                              Archive
                            </Button>
                          )}
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

      <AnnouncementFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => setCreateOpen(false)}
      />
      <AnnouncementFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        announcement={editing ?? undefined}
        onSuccess={() => setEditing(null)}
      />
      {managingAccess && (
        <AnnouncementAccessModal
          open={!!managingAccess}
          onClose={() => setManagingAccess(null)}
          announcementId={managingAccess.id}
          announcementTitle={managingAccess.title}
        />
      )}
    </div>
  );
}
