import { useMutation } from "@tanstack/react-query";
import { Paperclip, User } from "lucide-react";
import type { QueryMessageResponse } from "@internal-training/shared";
import { getMediaAccessUrl } from "../../services/api/media";

/**
 * Opens a query attachment (SYSTEM_PLAN.md §16): resolves the existing
 * `GET /media/:id/access-url` flow to a short-lived signed URL on demand,
 * then opens it — never a stored/direct link, matching every other media
 * reference in this app. Shared by the trainer's own thread view
 * (QueryDetailPage) and the admin management view (AdminQueryDetailPage,
 * Phase 6.7) — the server (not this component) decides who is actually
 * authorized to resolve a given attachment.
 */
function AttachmentLink({ mediaAssetId, filename }: { mediaAssetId: string; filename: string }) {
  const mutation = useMutation({
    mutationFn: () => getMediaAccessUrl(mediaAssetId),
    onSuccess: (result) => {
      window.open(result.url, "_blank", "noopener");
    },
  });

  return (
    <button
      type="button"
      className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-indigo-700 hover:underline disabled:opacity-50"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
      {mutation.isPending ? "Opening…" : filename}
    </button>
  );
}

function MessageBubble({ message, isMine }: { message: QueryMessageResponse; isMine: boolean }) {
  return (
    <div
      className={`rounded-lg border p-3 ${isMine ? "border-indigo-100 bg-indigo-50/50" : "border-slate-200 bg-white"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <User className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          {message.sender_name ?? "Unknown"}
        </div>
        <span className="text-xs text-slate-400">
          {new Date(message.created_at).toLocaleString()}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{message.message}</p>
      {message.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {message.attachments.map((attachment) => (
            <AttachmentLink
              key={attachment.id}
              mediaAssetId={attachment.id}
              filename={attachment.original_filename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A query's full conversation, oldest first (SYSTEM_PLAN.md §14.7). Each
 * message is styled by whether it came from the ticket owner (the
 * trainer, `sender_id === ticketOwnerId`) or a support reply — the same
 * visual convention in both the trainer's own view and the admin
 * management view, so a support reply is recognizably distinct from the
 * trainer's own messages in either context.
 */
export function QueryMessageThread({
  messages,
  ticketOwnerId,
  emptyMessage,
}: {
  messages: QueryMessageResponse[];
  ticketOwnerId: string;
  emptyMessage: string;
}) {
  if (messages.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }
  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          isMine={message.sender_id === ticketOwnerId}
        />
      ))}
    </div>
  );
}
