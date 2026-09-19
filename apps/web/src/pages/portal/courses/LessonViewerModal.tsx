import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import type { CourseDetailLesson, LessonProgressResponse } from "@internal-training/shared";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ApiClientError } from "../../../services/api/client";
import { getSafeHttpsUrl } from "../../../lib/safeUrl";
import { VideoLessonPlayer } from "./VideoLessonPlayer";
import { PdfLessonViewer } from "./PdfLessonViewer";
import { DocumentLessonViewer } from "./DocumentLessonViewer";
import { ExternalVideoPlayer, getEmbeddableVideoUrl } from "./ExternalVideoPlayer";
import { PresentationLessonViewer } from "./PresentationLessonViewer";
import { CONTENT_TYPE_META, STATUS_LABEL, type LessonEntry } from "./courseLessonMeta";

/**
 * Renders a lesson's actual content for the two content types that have
 * always just been inline data (TEXT/EXTERNAL_LINK). VIDEO/PDF/DOCUMENT/
 * PRESENTATION each have their own dedicated player/viewer component
 * (rendered directly by `LessonViewerModal` below, not through this function)
 * — see VideoLessonPlayer.tsx, PdfLessonViewer.tsx, DocumentLessonViewer.tsx,
 * PresentationLessonViewer.tsx.
 */
function LessonContent({ lesson }: { lesson: CourseDetailLesson }) {
  if (lesson.content_type === "TEXT") {
    return (
      <p className="whitespace-pre-wrap text-sm text-slate-700">
        {lesson.text_content ?? "This lesson has no content yet."}
      </p>
    );
  }
  if (lesson.content_type === "EXTERNAL_LINK" && lesson.external_url) {
    // A recognized YouTube/Vimeo link renders as an embedded player
    // (ExternalVideoPlayer.tsx); anything else keeps the plain "Open Resource" link.
    const embedUrl = getEmbeddableVideoUrl(lesson.external_url);
    if (embedUrl) {
      return <ExternalVideoPlayer embedUrl={embedUrl} title={lesson.title} />;
    }
    // Only https links are ever rendered as a link (legacy rows may hold other schemes).
    const safeUrl = getSafeHttpsUrl(lesson.external_url);
    if (!safeUrl) {
      return <p className="text-sm text-slate-400">This link is unavailable.</p>;
    }
    return (
      <a
        href={safeUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:underline"
      >
        Open Resource
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    );
  }
  return <p className="text-sm text-slate-400">This lesson has no content yet.</p>;
}

/** The lesson body: the same protected viewers (signed URLs, no download links) the expandable row used. */
function LessonBody({
  lesson,
  progress,
}: {
  lesson: CourseDetailLesson;
  progress: LessonProgressResponse | undefined;
}) {
  if (lesson.content_type === "VIDEO") {
    if (!lesson.media_asset_id) {
      return (
        <p className="text-sm text-slate-400">
          This lesson&apos;s video hasn&apos;t been uploaded yet.
        </p>
      );
    }
    if (!progress) {
      return (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      );
    }
    return (
      <VideoLessonPlayer
        lessonId={lesson.id}
        mediaAssetId={lesson.media_asset_id}
        authoritativeDurationSeconds={lesson.duration_seconds}
        progress={progress}
      />
    );
  }
  if (lesson.content_type === "PDF") {
    return lesson.media_asset_id ? (
      <PdfLessonViewer mediaAssetId={lesson.media_asset_id} />
    ) : (
      <p className="text-sm text-slate-400">
        This lesson&apos;s PDF hasn&apos;t been uploaded yet.
      </p>
    );
  }
  if (lesson.content_type === "DOCUMENT") {
    return lesson.media_asset_id ? (
      <DocumentLessonViewer
        mediaAssetId={lesson.media_asset_id}
        mimeType={lesson.media_mime_type}
      />
    ) : (
      <p className="text-sm text-slate-400">
        This lesson&apos;s document hasn&apos;t been uploaded yet.
      </p>
    );
  }
  if (lesson.content_type === "PRESENTATION") {
    return lesson.media_asset_id ? (
      <PresentationLessonViewer mediaAssetId={lesson.media_asset_id} />
    ) : (
      <p className="text-sm text-slate-400">
        This lesson&apos;s presentation hasn&apos;t been uploaded yet.
      </p>
    );
  }
  return <LessonContent lesson={lesson} />;
}

/**
 * Opens one lesson in a dialog (the card grids only list lessons). Everything
 * inside is unchanged from the old expandable row: the same protected
 * viewers, and the same completion rules — VIDEO lessons complete
 * automatically by watch-through percentage (SYSTEM_PLAN.md §18) and never get
 * a manual button; every other type keeps "Mark Complete".
 */
export function LessonViewerModal({
  entry,
  progress,
  progressError,
  isCompleting,
  onComplete,
  onRetryProgress,
  onClose,
}: {
  entry: LessonEntry | null;
  progress: LessonProgressResponse | undefined;
  progressError: unknown;
  isCompleting: boolean;
  onComplete: (lessonId: string) => void;
  onRetryProgress: () => void;
  onClose: () => void;
}) {
  if (!entry) return null;
  const { lesson, status } = entry;
  const { label, icon: Icon } = CONTENT_TYPE_META[lesson.content_type];
  const completedAt = progress?.completed_at;

  return (
    <Modal open onClose={onClose} title={lesson.title} wide>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="info">
          <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
          {label}
        </Badge>
        <Badge tone={lesson.is_required ? "warning" : "neutral"}>
          {lesson.is_required ? "Required" : "Optional"}
        </Badge>
        <Badge
          tone={status === "COMPLETED" ? "success" : status === "IN_PROGRESS" ? "info" : "neutral"}
        >
          {STATUS_LABEL[status]}
        </Badge>
      </div>

      {lesson.description && <p className="mt-3 text-sm text-slate-600">{lesson.description}</p>}

      {progressError != null && (
        <div className="mt-3 flex items-center gap-2 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {progressError instanceof ApiClientError
            ? progressError.message
            : "Couldn't load progress for this lesson."}
          <button
            type="button"
            className="cursor-pointer font-medium underline"
            onClick={onRetryProgress}
          >
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <LessonBody lesson={lesson} progress={progress} />

        {/*
          VIDEO lessons never get the manual button — per SYSTEM_PLAN.md §18,
          video completion is driven by watch-through percentage
          (VideoLessonPlayer), not a user action. The "Completed" confirmation
          still applies uniformly once that auto-completion lands.
        */}
        {lesson.content_type !== "VIDEO" && status !== "COMPLETED" && (
          <div className="mt-4 flex items-center gap-3">
            <Button
              type="button"
              variant="primary"
              className="gap-1.5 px-3 py-1.5 text-xs"
              disabled={isCompleting}
              onClick={() => onComplete(lesson.id)}
            >
              {isCompleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Mark Complete
            </Button>
          </div>
        )}
        {status === "COMPLETED" && (
          <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Completed
            {completedAt ? ` on ${new Date(completedAt).toLocaleDateString()}` : ""}
          </p>
        )}
      </div>
    </Modal>
  );
}
