import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, ImageIcon, X } from "lucide-react";
import type { AnnouncementPriority } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { getMediaAccessUrl } from "../../../services/api/media";
import { getDashboard } from "../../../services/api/dashboard";
import { acknowledgeAnnouncement, dismissAnnouncement } from "../../../services/api/announcements";

const PRIORITY_TONE: Record<AnnouncementPriority, BadgeTone> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "danger",
};

/**
 * Portal-open popup (SYSTEM_PLAN.md §14.6/§21, Phase 5.3.6): "`show_as_popup`
 * drives the first-open modal, gated by `announcement_reads.dismissed_at`
 * ... a server-tracked fact, not localStorage." Deliberately reuses the
 * SAME `["dashboard"]` query (`GET /dashboard`) UserDashboardPage.tsx
 * already fetches — TanStack Query dedupes the two callers into one network
 * request — rather than a second popup-specific endpoint/query
 * (§26: "do not create a second dashboard API"; this phase: "do not create
 * duplicate popup logic"). `popup_announcements` is already filtered
 * server-side to PUBLISHED, department-visible, `show_as_popup=true`, and
 * not-yet-dismissed rows (announcements.service.ts's `listPopupAnnouncements`)
 * — this component only ever decides WHEN to show one, never WHICH ones
 * are eligible.
 *
 * Mounted once in UserPortalLayout.tsx (not per-page), so it surfaces once
 * per portal session/reload — closing it (Escape/backdrop/X) without
 * acknowledging or dismissing just hides it for this render; per §14.6's
 * own literal rule, only an explicit Dismiss (or the caller already having
 * dismissed it previously) stops it from appearing again on the next
 * portal open. A queue (not a stack of modals) advances to the next
 * eligible announcement, if any, after each close.
 */
export function PortalAnnouncementPopup() {
  const queryClient = useQueryClient();
  const [queueIndex, setQueueIndex] = useState(0);
  const [dismissedLocally, setDismissedLocally] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });

  const popupAnnouncements = dashboardQuery.data?.popup_announcements ?? [];
  const current = dismissedLocally ? null : (popupAnnouncements[queueIndex] ?? null);

  // Invalidates every cache this same read-state can appear in — the
  // Announcements list page (["announcements"]) and its detail modal
  // (["announcement-detail", id]), not just ["dashboard"] — so acting on
  // the popup doesn't leave those other pages showing stale read/ack/
  // dismiss state if the trainee navigates to them afterward in the same
  // session (the same cross-cache consistency AnnouncementDetailModal.tsx
  // now applies in reverse for this same reason).
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["announcements"] });
    if (current) {
      await queryClient.invalidateQueries({ queryKey: ["announcement-detail", current.id] });
    }
  };

  const ackMutation = useMutation({
    mutationFn: (id: string) => acknowledgeAnnouncement(id),
    onSuccess: async () => {
      await invalidate();
      advance();
    },
  });
  const dismissMutation = useMutation({
    mutationFn: (id: string) => dismissAnnouncement(id),
    onSuccess: async () => {
      await invalidate();
      advance();
    },
  });
  const imageUrlMutation = useMutation({
    mutationFn: (mediaAssetId: string) => getMediaAccessUrl(mediaAssetId),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener"),
  });

  function advance() {
    setQueueIndex((i) => i + 1);
  }

  function handleClose() {
    // Escape/backdrop/X: local-only, does not call dismiss — per §14.6 this
    // announcement remains popup-eligible on the next portal open unless
    // explicitly dismissed. Prevents re-showing again THIS session only.
    setDismissedLocally(true);
  }

  if (!current) return null;

  return (
    <Modal open onClose={handleClose} title="Announcement">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-slate-900">{current.title}</h3>
          <div className="flex items-center gap-1.5">
            {current.is_important && <Badge tone="danger">Important</Badge>}
            <Badge tone={PRIORITY_TONE[current.priority]}>{current.priority}</Badge>
          </div>
        </div>

        <p className="whitespace-pre-wrap text-sm text-slate-700">{current.body}</p>

        {(current.image_media_id || current.attachment_media_id) && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {current.image_media_id && (
              <Button
                variant="secondary"
                className="gap-1.5 px-2 py-1 text-xs"
                disabled={imageUrlMutation.isPending}
                onClick={() => imageUrlMutation.mutate(current.image_media_id!)}
              >
                <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                View Image
              </Button>
            )}
            {current.attachment_media_id && (
              <Button
                variant="secondary"
                className="gap-1.5 px-2 py-1 text-xs"
                disabled={imageUrlMutation.isPending}
                onClick={() => imageUrlMutation.mutate(current.attachment_media_id!)}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                View Attachment
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <Button
            variant="secondary"
            className="gap-1.5"
            disabled={dismissMutation.isPending}
            onClick={() => dismissMutation.mutate(current.id)}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Dismiss
          </Button>
          <Button
            className="gap-1.5"
            disabled={ackMutation.isPending}
            onClick={() => ackMutation.mutate(current.id)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Acknowledge
          </Button>
        </div>
      </div>
    </Modal>
  );
}
