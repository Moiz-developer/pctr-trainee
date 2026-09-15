import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Paperclip, Tags } from "lucide-react";
import type { QueryPriority, QueryStatus } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { SelectField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listAdminQueries, listQueryCategories } from "../../../services/api/adminQueries";

const STATUS_TONE: Record<QueryStatus, BadgeTone> = {
  OPEN: "info",
  UNDER_REVIEW: "warning",
  RESPONDED: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

const STATUS_LABEL: Record<QueryStatus, string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under Review",
  RESPONDED: "Responded",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const PRIORITY_TONE: Record<QueryPriority, BadgeTone> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "danger",
};

/**
 * Admin Query Queue (SYSTEM_PLAN.md §14.7/§22/§26, Phase 6.6, permission
 * `query.manage` — enforced server-side; this page has no client-side
 * permission gate of its own since `/admin/*` already requires an
 * admin-tier permission, and the API is the authoritative check, §10).
 * Every ticket, not just the viewer's own, mirroring MyQueriesPage.tsx's
 * table shape one level up (adds "Trainer", drops nothing) plus
 * status/priority/category filters. No SUPPORT role anywhere —
 * authorization is the permission code alone. Each row opens the full
 * management view (Phase 6.7, `/admin/queries/:id`).
 */
export function AdminQueriesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<QueryStatus | "">("");
  const [priority, setPriority] = useState<QueryPriority | "">("");
  const [category, setCategory] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["admin-query-categories"],
    queryFn: listQueryCategories,
  });

  const query = useQuery({
    queryKey: ["admin-queries", page, status, priority, category],
    queryFn: () =>
      listAdminQueries({
        page,
        pageSize: 20,
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
      }),
  });

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }
  const handleStatusChange = resetToFirstPage(setStatus);
  const handlePriorityChange = resetToFirstPage(setPriority);
  const handleCategoryChange = resetToFirstPage(setCategory);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Queries</h2>
          <p className="mt-1 text-sm text-slate-500">
            All trainer support tickets, across every trainer.
          </p>
        </div>
        <Button
          variant="secondary"
          className="gap-2"
          onClick={() => void navigate("/admin/queries/categories")}
        >
          <Tags className="h-4 w-4" aria-hidden="true" />
          Manage Categories
        </Button>
      </div>

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label="Status"
            id="filter-status"
            value={status}
            onChange={(event) => handleStatusChange(event.target.value as QueryStatus | "")}
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as QueryStatus[]).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Priority"
            id="filter-priority"
            value={priority}
            onChange={(event) => handlePriorityChange(event.target.value as QueryPriority | "")}
          >
            <option value="">All priorities</option>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </SelectField>
          <SelectField
            label="Category"
            id="filter-category"
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value)}
          >
            <option value="">All categories</option>
            {(categoriesQuery.data ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
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
          emptyTitle="No queries match these filters"
          emptyDescription="Try clearing a filter, or check back once trainers submit tickets."
        >
          {(items) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Trainer</th>
                    <th className="py-2 pr-4">Subject</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Related Course</th>
                    <th className="py-2 pr-4">Priority</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                      onClick={() => void navigate(`/admin/queries/${item.id}`)}
                    >
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {item.user_full_name}
                      </td>
                      <td className="max-w-xs py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          {item.has_attachment && (
                            <Paperclip
                              className="h-3.5 w-3.5 shrink-0 text-slate-400"
                              aria-label="Has attachment"
                            />
                          )}
                          <span className="truncate text-slate-700">{item.subject}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {item.category_name ?? item.category ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{item.course_title ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {new Date(item.updated_at).toLocaleDateString()}
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
    </div>
  );
}
