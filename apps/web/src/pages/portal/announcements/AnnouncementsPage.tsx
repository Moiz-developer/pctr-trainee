import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImageIcon, Megaphone, Paperclip } from "lucide-react";
import type { AnnouncementPriority } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listAnnouncements } from "../../../services/api/announcements";
import { AnnouncementDetailModal } from "./AnnouncementDetailModal";

const PRIORITY_TONE: Record<AnnouncementPriority, BadgeTone> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "danger",
};

/**
 * Announcements (SYSTEM_PLAN.md §4/§14.6/§21/§26): every PUBLISHED
 * announcement the caller's department(s) can see (or a globally-visible
 * one — §14.6/§21's "empty department mapping = globally visible" rule),
 * server-filtered by `GET /announcements`, never a client-side filter of a
 * broader fetched set. Mirrors ResourcesPage.tsx/PoliciesPage.tsx's exact
 * list+pagination shape. Opening a row's detail (not the list itself) is
 * what marks it read, matching the backend's own read-tracking design —
 * see AnnouncementDetailModal.tsx.
 */
export function AnnouncementsPage() {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["announcements", page],
    queryFn: () => listAnnouncements({ page, pageSize: 20 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Announcements</h2>
        <p className="mt-1 text-sm text-slate-500">Company-wide and department news.</p>
      </div>

      <Card>
        <RemoteDataView
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data?.data}
          onRetry={() => void query.refetch()}
          isEmpty={(items) => items.length === 0}
          emptyTitle="No announcements"
          emptyDescription="Check back later."
        >
          {(items) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Author</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Priority</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const unread = !item.read_state.is_read;
                    return (
                      <tr
                        key={item.id}
                        className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                        onClick={() => setOpenId(item.id)}
                      >
                        <td className="max-w-sm py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {unread && (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-indigo-600"
                                aria-label="Unread"
                              />
                            )}
                            <Megaphone
                              className="h-3.5 w-3.5 shrink-0 text-slate-400"
                              aria-hidden="true"
                            />
                            <div className="min-w-0">
                              <p
                                className={`truncate ${unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}
                              >
                                {item.title}
                              </p>
                              <p className="truncate text-xs text-slate-500">{item.body}</p>
                            </div>
                            {item.is_important && <Badge tone="danger">Important</Badge>}
                            {item.image_media_id && (
                              <ImageIcon
                                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                                aria-label="Has image"
                              />
                            )}
                            {item.attachment_media_id && (
                              <Paperclip
                                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                                aria-label="Has attachment"
                              />
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {item.author_full_name ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {item.published_at
                            ? new Date(item.published_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenId(item.id);
                            }}
                          >
                            {unread ? "Read" : "View"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
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

      <AnnouncementDetailModal
        open={openId !== null}
        onClose={() => setOpenId(null)}
        announcementId={openId}
      />
    </div>
  );
}
