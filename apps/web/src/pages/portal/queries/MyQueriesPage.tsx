import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Paperclip, Plus } from "lucide-react";
import type { QueryPriority, QueryStatus } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listMyQueries } from "../../../services/api/queries";
import { CreateQueryModal } from "./CreateQueryModal";

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
 * My Queries (SYSTEM_PLAN.md §4/§14.7/§22/§26): create + list the caller's
 * own support tickets — the self-service half of Query/Support (§25's
 * required "Query/Support" User Portal section). Admin oversight/reply
 * threading is a separate, not-yet-built unit; this page only ever shows
 * status/basic metadata for tickets this user created, exactly what
 * `GET /queries` returns (server-enforced self-only via that endpoint's own
 * `WHERE user_id = <caller>`, never a client-supplied filter this page
 * could get wrong).
 *
 * Table layout (Phase 6.3) mirrors the same `<table>` structure already
 * used by admin list pages (e.g. AdminTrainingHourRequirementsPage.tsx) —
 * the established pattern in this codebase for a multi-column record list,
 * reused here rather than inventing a second list-rendering convention.
 * Each row opens the query's own thread (Phase 6.4, `/app/queries/:id`).
 */
export function MyQueriesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: ["my-queries", page],
    queryFn: () => listMyQueries({ page, pageSize: 20 }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My Queries</h2>
          <p className="mt-1 text-sm text-slate-500">
            Submit a question or issue and track its status here.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Query
        </Button>
      </div>

      <Card>
        <RemoteDataView
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data?.data}
          onRetry={() => void query.refetch()}
          isEmpty={(items) => items.length === 0}
          emptyTitle="No queries yet"
          emptyDescription="Submit a query and it will appear here."
        >
          {(items) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Subject</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Related Course</th>
                    <th className="py-2 pr-4">Priority</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                      onClick={() => void navigate(`/app/queries/${item.id}`)}
                    >
                      <td className="max-w-xs py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          {item.has_attachment && (
                            <Paperclip
                              className="h-3.5 w-3.5 shrink-0 text-slate-400"
                              aria-label="Has attachment"
                            />
                          )}
                          <span className="truncate font-medium text-slate-900">
                            {item.subject}
                          </span>
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

      <CreateQueryModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => setPage(1)}
      />
    </div>
  );
}
