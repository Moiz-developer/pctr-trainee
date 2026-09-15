import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2, Paperclip, Send } from "lucide-react";
import type { QueryPriority, QueryStatus } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextAreaField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { QueryMessageThread } from "../../../components/shared/QueryMessageThread";
import { ApiClientError } from "../../../services/api/client";
import { uploadQueryAttachment } from "../../../services/api/media";
import {
  createAdminQueryMessage,
  getAdminQueryDetail,
  listQueryManagers,
  updateAdminQuery,
} from "../../../services/api/adminQueries";

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
 * Admin Query Management (SYSTEM_PLAN.md §14.7/§22/§26, Phase 6.7,
 * permission `query.manage` — enforced server-side; no client-side
 * permission gate here beyond the existing `/admin/*` admin-tier check,
 * §10). View the complete conversation, reply, view authorized
 * attachments, assign, and change status — all on the same
 * `queries`/`query_messages`/`query_attachments` tables the trainer's own
 * QueryDetailPage.tsx uses (shares its `QueryMessageThread` component
 * outright); no separate support architecture, no SUPPORT role.
 */
export function AdminQueryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  const detailQuery = useQuery({
    queryKey: ["admin-query-detail", id],
    queryFn: () => getAdminQueryDetail(id!),
    enabled: !!id,
  });

  const managersQuery = useQuery({
    queryKey: ["query-managers"],
    queryFn: listQueryManagers,
  });

  const invalidateDetail = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-query-detail", id] });

  const statusMutation = useMutation({
    mutationFn: (status: QueryStatus) => updateAdminQuery(id!, { status }),
    onSuccess: async () => {
      await invalidateDetail();
      await queryClient.invalidateQueries({ queryKey: ["admin-queries"] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (assignedTo: string) => updateAdminQuery(id!, { assigned_to: assignedTo || null }),
    onSuccess: async () => {
      await invalidateDetail();
      await queryClient.invalidateQueries({ queryKey: ["admin-queries"] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const media_asset_id = attachment ? (await uploadQueryAttachment(attachment)).id : undefined;
      return createAdminQueryMessage(id!, { message: reply, media_asset_id });
    },
    onSuccess: async () => {
      setReply("");
      setAttachment(null);
      await invalidateDetail();
    },
  });

  if (!id) return null;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => void navigate("/admin/queries")}
        className="flex cursor-pointer items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Queries
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
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{detail.subject}</h2>
                  <p className="mt-1 text-sm text-slate-600">From {detail.user_full_name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Created {new Date(detail.created_at).toLocaleString()} · Last updated{" "}
                    {new Date(detail.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={PRIORITY_TONE[detail.priority]}>{detail.priority}</Badge>
                  <Badge tone={STATUS_TONE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Category
                  </dt>
                  <dd className="mt-0.5 text-slate-700">
                    {detail.category_name ?? detail.category ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Related Course
                  </dt>
                  <dd className="mt-0.5 text-slate-700">{detail.course_title ?? "—"}</dd>
                </div>
              </dl>
              <dl className="mt-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {detail.description}
                </dd>
              </dl>
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Manage</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  label="Status"
                  id="manage-status"
                  value={detail.status}
                  disabled={statusMutation.isPending}
                  onChange={(event) => statusMutation.mutate(event.target.value as QueryStatus)}
                >
                  {(Object.keys(STATUS_LABEL) as QueryStatus[]).map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABEL[value]}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Assigned To"
                  id="manage-assignee"
                  value={detail.assigned_to ?? ""}
                  disabled={assignMutation.isPending}
                  onChange={(event) => assignMutation.mutate(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {(managersQuery.data ?? []).map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.full_name}
                    </option>
                  ))}
                </SelectField>
              </div>
              {(statusMutation.isError || assignMutation.isError) && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Failed to update the query. Please try again.
                </p>
              )}
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Conversation</h3>
              <QueryMessageThread
                messages={detail.messages}
                ticketOwnerId={detail.user_id}
                emptyMessage="No messages yet. Reply below to start the conversation."
              />

              <div className="mt-4 border-t border-slate-100 pt-4">
                <TextAreaField
                  label="Reply to trainer"
                  id="admin-reply-message"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Type your response…"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <input
                      id="admin-reply-attachment"
                      type="file"
                      className="block text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                      onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                    />
                  </div>
                  <Button
                    type="button"
                    className="gap-1.5"
                    disabled={replyMutation.isPending || reply.trim().length === 0}
                    onClick={() => replyMutation.mutate()}
                  >
                    {replyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                    Send Reply
                  </Button>
                </div>
                {replyMutation.isError && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {replyMutation.error instanceof ApiClientError
                      ? replyMutation.error.message
                      : "Failed to send your reply."}
                  </p>
                )}
              </div>
            </Card>
          </>
        )}
      </RemoteDataView>
    </div>
  );
}
