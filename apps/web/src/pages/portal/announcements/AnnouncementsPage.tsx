import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Megaphone,
  Paperclip,
  User,
} from "lucide-react";
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

/** Page numbers to render: always first/last/current ±1, with "…" for gaps. */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const wanted = [1, current - 1, current, current + 1, total]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  let previous = 0;
  for (const page of wanted) {
    if (page === previous) continue;
    if (page - previous > 1) result.push("…");
    result.push(page);
    previous = page;
  }
  return result;
}

/**
 * Announcements (SYSTEM_PLAN.md §4/§14.6/§21/§26): every PUBLISHED
 * announcement the caller's department(s) can see (or a globally-visible
 * one — §14.6/§21's "empty department mapping = globally visible" rule),
 * server-filtered by `GET /announcements`, never a client-side filter of a
 * broader fetched set. Presented as a card grid with numbered pagination
 * driven by the API's own `meta` (page/pageSize/totalItems/totalPages).
 * Opening an announcement's detail (not the list itself) is what marks it
 * read, matching the backend's own read-tracking design — see
 * AnnouncementDetailModal.tsx.
 *
 * Grid columns follow the usable content width (the sidebar takes 240px from
 * `lg` up): 1 → 2 (md) → 3 (xl) → 4 (≥1800px), so cards stay ~300–400px wide.
 */
export function AnnouncementsPage() {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["announcements", page],
    queryFn: () => listAnnouncements({ page, pageSize: 20 }),
  });

  const hasItems = (query.data?.data.length ?? 0) > 0;
  const meta = query.data?.meta;

  const content = (
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
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4">
          {items.map((item) => {
            const unread = !item.read_state.is_read;
            return (
              <li key={item.id} className="min-w-0">
                <article
                  className="relative flex h-full cursor-pointer flex-col overflow-hidden rounded-lg bg-gradient-to-b from-white to-indigo-50/40 p-5 shadow-[0_1px_3px_rgba(49,44,133,0.10)] ring-1 ring-indigo-100 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(49,44,133,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  onClick={() => setOpenId(item.id)}
                >
                  {unread && (
                    <span
                      className="absolute inset-y-0 left-0 w-1 bg-indigo-900"
                      aria-hidden="true"
                    />
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-900">
                      <Megaphone className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
                      {item.is_important && (
                        <Badge tone="danger" solid>
                          Important
                        </Badge>
                      )}
                    </div>
                  </div>

                  <h3
                    className={`mt-3 line-clamp-2 break-words text-base leading-snug text-indigo-950 ${
                      unread ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {item.title}
                  </h3>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {item.published_at && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                        {new Date(item.published_at).toLocaleDateString()}
                      </span>
                    )}
                    {item.author_full_name && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.author_full_name}</span>
                      </span>
                    )}
                  </div>

                  <p className="mt-3 line-clamp-3 flex-1 break-words text-sm leading-relaxed text-slate-600">
                    {item.body}
                  </p>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-indigo-100 pt-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                      {unread ? (
                        <Badge tone="info" solid>
                          New
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Read
                        </span>
                      )}
                      {item.image_media_id && (
                        <span
                          className="inline-flex items-center rounded bg-indigo-50 p-1 text-indigo-900"
                          title="Has image"
                        >
                          <ImageIcon className="h-3.5 w-3.5" aria-label="Has image" />
                        </span>
                      )}
                      {item.attachment_media_id && (
                        <span
                          className="inline-flex items-center rounded bg-indigo-50 p-1 text-indigo-900"
                          title="Has attachment"
                        >
                          <Paperclip className="h-3.5 w-3.5" aria-label="Has attachment" />
                        </span>
                      )}
                    </div>
                    <Button
                      variant={unread ? "primary" : "secondary"}
                      className="shrink-0 px-4 py-1.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenId(item.id);
                      }}
                    >
                      {unread ? "Read" : "View"}
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </RemoteDataView>
  );

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-6 pb-2">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Announcements</h2>
        <p className="mt-1 text-sm text-slate-500">Company-wide and department news.</p>
      </div>

      {hasItems ? content : <Card>{content}</Card>}

      {meta && meta.totalPages > 1 && (
        <nav
          aria-label="Announcements pagination"
          className="flex flex-col items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-[0_1px_4px_rgba(49,44,133,0.10)] sm:flex-row sm:justify-between"
        >
          <p className="text-xs text-slate-500">
            Page {meta.page} of {meta.totalPages} · {meta.totalItems} total
          </p>
          <div className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="gap-1 px-3 py-1.5 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Previous
            </Button>
            <div className="hidden items-center gap-1.5 sm:flex">
              {pageWindow(meta.page, meta.totalPages).map((entry, index) =>
                entry === "…" ? (
                  <span key={`gap-${index}`} className="px-1 text-xs text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    aria-label={`Page ${entry}`}
                    aria-current={entry === meta.page ? "page" : undefined}
                    onClick={() => setPage(entry)}
                    className={`h-8 min-w-8 cursor-pointer rounded-md px-2 text-xs font-medium transition-colors ${
                      entry === meta.page
                        ? "bg-indigo-900 text-white"
                        : "bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
                    }`}
                  >
                    {entry}
                  </button>
                ),
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="gap-1 px-3 py-1.5 text-xs"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}

      <AnnouncementDetailModal
        open={openId !== null}
        onClose={() => setOpenId(null)}
        announcementId={openId}
      />
    </div>
  );
}
