import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, ImageIcon, User, X } from "lucide-react";
import type { AnnouncementPriority } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { ProtectedFileViewer } from "../courses/ProtectedFileViewer";
import {
  PDF_ONLY_MODAL,
  usePdfModalSizing,
  type PdfViewerSizingProps,
} from "../courses/pdfModalSizing";
import {
  acknowledgeAnnouncement,
  dismissAnnouncement,
  getAnnouncementDetail,
} from "../../../services/api/announcements";

const PRIORITY_TONE: Record<AnnouncementPriority, BadgeTone> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "danger",
};

/**
 * Shows an announcement image/attachment inside the portal (toggle), through
 * the shared protected viewer — never a stored/direct link and never a raw
 * signed-URL "open in new tab" (which would be a normal download path). The
 * access-url authorization (GET /media/:id/access-url) is unchanged.
 */
function MediaLink({
  mediaAssetId,
  label,
  icon: Icon,
  pdfProps,
}: {
  mediaAssetId: string;
  label: string;
  icon: typeof Download;
  pdfProps: PdfViewerSizingProps;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={open ? "w-full" : ""}>
      <Button
        variant="secondary"
        className="gap-1.5 px-2 py-1 text-xs"
        onClick={() => setOpen((current) => !current)}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {open ? "Hide" : label}
      </Button>
      {open && (
        <div className="mt-3">
          <ProtectedFileViewer mediaAssetId={mediaAssetId} pdfProps={pdfProps} />
        </div>
      )}
    </div>
  );
}

/**
 * Opening this modal fetches `GET /announcements/:id`, which marks the
 * announcement read server-side as a side effect (announcements.service.ts)
 * — this is deliberately the ONLY place in the trainee UI that triggers a
 * read, mirroring the backend's own "list never marks read, detail does"
 * design so unread badges on the list stay meaningful.
 */
export function AnnouncementDetailModal({
  open,
  onClose,
  announcementId,
}: {
  open: boolean;
  onClose: () => void;
  announcementId: string | null;
}) {
  const queryClient = useQueryClient();
  // Sizes the modal to an attached PDF's page (shared with every PDF modal, see pdfModalSizing.ts).
  const pdfFit = usePdfModalSizing(PDF_ONLY_MODAL);
  const toast = useToast();

  const detailQuery = useQuery({
    queryKey: ["announcement-detail", announcementId],
    queryFn: () => getAnnouncementDetail(announcementId!),
    enabled: open && !!announcementId,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["announcement-detail", announcementId] });
    await queryClient.invalidateQueries({ queryKey: ["announcements"] });
    // Phase 5.3.6: GET /dashboard now embeds this same caller's read state
    // (`announcements`) and popup eligibility (`popup_announcements`,
    // gated by `dismissed_at` — see PortalAnnouncementPopup.tsx). Without
    // this, acknowledging/dismissing here (the list page) would leave a
    // stale cached `["dashboard"]` entry that could still surface the
    // just-dismissed announcement as a popup later in the same session —
    // directly violating "do not repeatedly show announcements already
    // acknowledged/dismissed."
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const ackMutation = useMutation({
    mutationFn: () => acknowledgeAnnouncement(announcementId!),
    onSuccess: async () => {
      await invalidate();
      toast.success("Announcement acknowledged.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to acknowledge.");
    },
  });
  const dismissMutation = useMutation({
    mutationFn: () => dismissAnnouncement(announcementId!),
    onSuccess: async () => {
      await invalidate();
      toast.success("Announcement dismissed.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to dismiss.");
    },
  });

  if (!announcementId) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Announcement"
      wide
      size={pdfFit.size}
      maxWidth={pdfFit.maxWidth}
    >
      <RemoteDataView
        isLoading={detailQuery.isLoading}
        isError={detailQuery.isError}
        error={detailQuery.error}
        data={detailQuery.data}
        onRetry={() => void detailQuery.refetch()}
      >
        {(announcement) => (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{announcement.title}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  {announcement.author_full_name ?? "Unknown"}
                  {announcement.published_at &&
                    ` · ${new Date(announcement.published_at).toLocaleString()}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {announcement.is_important && <Badge tone="danger">Important</Badge>}
                <Badge tone={PRIORITY_TONE[announcement.priority]}>{announcement.priority}</Badge>
              </div>
            </div>

            <p className="whitespace-pre-wrap text-sm text-slate-700">{announcement.body}</p>

            {(announcement.image_media_id || announcement.attachment_media_id) && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {announcement.image_media_id && (
                  <MediaLink
                    mediaAssetId={announcement.image_media_id}
                    label="View Image"
                    icon={ImageIcon}
                    pdfProps={pdfFit.viewerProps}
                  />
                )}
                {announcement.attachment_media_id && (
                  <MediaLink
                    mediaAssetId={announcement.attachment_media_id}
                    label="View Attachment"
                    icon={Download}
                    pdfProps={pdfFit.viewerProps}
                  />
                )}
              </div>
            )}

            {announcement.is_important && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {announcement.read_state.acknowledged_at ? (
                  <Badge tone="success">Acknowledged</Badge>
                ) : (
                  <Button
                    className="gap-1.5"
                    disabled={ackMutation.isPending}
                    onClick={() => ackMutation.mutate()}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Acknowledge
                  </Button>
                )}
                {announcement.read_state.dismissed_at ? (
                  <Badge tone="neutral">Dismissed</Badge>
                ) : (
                  <Button
                    variant="secondary"
                    className="gap-1.5"
                    disabled={dismissMutation.isPending}
                    onClick={() => dismissMutation.mutate()}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Dismiss
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </RemoteDataView>
    </Modal>
  );
}
