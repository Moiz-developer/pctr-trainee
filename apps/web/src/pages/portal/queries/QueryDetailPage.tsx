import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Paperclip, Send } from "lucide-react";
import type { QueryPriority, QueryStatus } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { TextAreaField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { QueryMessageThread } from "../../../components/shared/QueryMessageThread";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { createQueryMessage, getQueryDetail } from "../../../services/api/queries";
import { uploadQueryAttachment } from "../../../services/api/media";

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
 * Query detail / conversation thread (Phase 6.4, SYSTEM_PLAN.md §14.7/§22).
 * A trainee sees exactly what `GET /queries/:id` returns for their own
 * ticket — the original query plus every message in it, including
 * Admin/Support responses (any message on a query this caller owns is
 * visible, not just their own — see queries.service.ts's own doc comment).
 * No separate support architecture: replying reuses the same
 * `query_messages`/`query_attachments` tables and the same upload flow
 * already built for ticket creation (Phase 6.2).
 */
export function QueryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  const detailQuery = useQuery({
    queryKey: ["query-detail", id],
    queryFn: () => getQueryDetail(id!),
    enabled: !!id,
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const media_asset_id = attachment ? (await uploadQueryAttachment(attachment)).id : undefined;
      return createQueryMessage(id!, { message: reply, media_asset_id });
    },
    onSuccess: async () => {
      setReply("");
      setAttachment(null);
      await queryClient.invalidateQueries({ queryKey: ["query-detail", id] });
      toast.success("Reply sent.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to send your reply.");
    },
  });

  if (!id) return null;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => void navigate("/app/queries")}
        className="flex cursor-pointer items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to My Queries
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
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Conversation</h3>
              <QueryMessageThread
                messages={detail.messages}
                ticketOwnerId={detail.user_id}
                emptyMessage="No replies yet. Support will respond here once they review your query."
              />

              <div className="mt-4 border-t border-slate-100 pt-4">
                <TextAreaField
                  label="Add a reply"
                  id="reply-message"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Type a follow-up message…"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <input
                      id="reply-attachment"
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
                    Send
                  </Button>
                </div>
              </div>
            </Card>
          </>
        )}
      </RemoteDataView>
    </div>
  );
}
