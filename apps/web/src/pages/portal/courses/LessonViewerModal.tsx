import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MinusCircle,
  type LucideIcon,
} from "lucide-react";
import type { CourseDetailLesson, LessonProgressResponse } from "@internal-training/shared";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ApiClientError } from "../../../services/api/client";
import { getSafeHttpsUrl } from "../../../lib/safeUrl";
import { VideoLessonPlayer } from "./VideoLessonPlayer";
import { DocumentPreviewButton } from "./DocumentPreviewButton";
import { ExternalVideoPlayer, getEmbeddableVideoUrl } from "./ExternalVideoPlayer";
import { PresentationLessonViewer } from "./PresentationLessonViewer";
import { ProtectedFileViewer } from "./ProtectedFileViewer";
import {
  CONTENT_TYPE_META,
  LESSON_CATEGORY_META,
  LESSON_CATEGORY_ORDER,
  getGroupCompletionPct,
  getLessonCategory,
  getLessonViewerKind,
  STATUS_LABEL,
  type LessonCategory,
  type LessonEntry,
  type ModuleGroup,
} from "./courseLessonMeta";
import { RichText } from "../../../components/ui/RichText";

/**
 * Renders a lesson's actual content for the two content types that have
 * always just been inline data (TEXT/EXTERNAL_LINK). VIDEO and media-backed
 * lessons each have their own dedicated player/viewer component (chosen in
 * `LessonBody` below) — see VideoLessonPlayer.tsx, PdfLessonViewer.tsx,
 * DocumentLessonViewer.tsx, PresentationLessonViewer.tsx.
 */
function LessonContent({ lesson }: { lesson: CourseDetailLesson }) {
  if (lesson.content_type === "TEXT") {
    return (
      <RichText
        value={lesson.text_content ?? "This lesson has no content yet."}
        className="text-sm leading-relaxed text-slate-700"
      />
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

const NOT_UPLOADED_MESSAGE: Partial<Record<CourseDetailLesson["content_type"], string>> = {
  VIDEO: "This lesson's video hasn't been uploaded yet.",
  PDF: "This lesson's PDF hasn't been uploaded yet.",
  DOCUMENT: "This lesson's document hasn't been uploaded yet.",
  PRESENTATION: "This lesson's presentation hasn't been uploaded yet.",
};

/**
 * The lesson body: the same protected viewers (signed URLs, no download links)
 * the expandable row used. The viewer is chosen from the file's REAL type
 * (`getLessonViewerKind`), so a lesson labelled "PDF" that actually holds a DOCX
 * goes through the document viewer instead of failing in pdf.js.
 *
 * UI consistency unit: a document (PDF/DOCX/legacy DOC/XLS/XLSX) is never rendered
 * directly in this lesson-browsing modal — same as Resources/Policies, it opens in
 * its own dedicated modal via the shared `DocumentPreviewButton`, sized to that
 * document alone rather than resizing this whole modal around it.
 */
function LessonBody({
  lesson,
  progress,
}: {
  lesson: CourseDetailLesson;
  progress: LessonProgressResponse | undefined;
}) {
  const kind = getLessonViewerKind(lesson);

  switch (kind) {
    case "VIDEO":
      if (!lesson.media_asset_id) {
        return <p className="text-sm text-slate-400">{NOT_UPLOADED_MESSAGE.VIDEO}</p>;
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
    case "PDF":
    case "DOCX":
    case "LEGACY_DOC":
    case "SPREADSHEET":
      return (
        <DocumentPreviewButton
          mediaAssetId={lesson.media_asset_id!}
          mimeType={lesson.media_mime_type}
          title={lesson.title}
          className="w-full gap-1.5"
        />
      );
    case "PRESENTATION":
      return <PresentationLessonViewer mediaAssetId={lesson.media_asset_id!} />;
    case "IMAGE":
      return (
        <ProtectedFileViewer
          mediaAssetId={lesson.media_asset_id!}
          mimeType={lesson.media_mime_type}
        />
      );
    case "NO_MEDIA":
      return (
        <p className="text-sm text-slate-400">
          {NOT_UPLOADED_MESSAGE[lesson.content_type] ?? "This lesson has no content yet."}
        </p>
      );
    default:
      return <LessonContent lesson={lesson} />;
  }
}

// The reference's amber corner accent, shared by the three type cards.
function CategoryCard({
  icon: Icon,
  label,
  caption,
  active,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  caption: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`relative flex cursor-pointer flex-col items-center overflow-hidden rounded-lg px-4 py-5 text-center shadow-[0_1px_4px_rgba(49,44,133,0.10)] transition-colors sm:py-7 ${
        active ? "bg-indigo-950 text-white" : "bg-white text-indigo-950 hover:bg-indigo-50"
      }`}
    >
      <span
        className="absolute -right-6 -top-6 h-14 w-14 rounded-full bg-accent"
        aria-hidden="true"
      />
      <Icon className="h-7 w-7" aria-hidden="true" />
      <span className="mt-2 text-lg font-semibold">{label}</span>
      <span className={`text-xs ${active ? "text-white/80" : "text-slate-500"}`}>{caption}</span>
    </button>
  );
}

const CATEGORY_GRID_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

/**
 * Opens one lesson from a chapter/task card, laid out like the reference
 * "Chapter Detail" view: type cards (Presentation / Videos / Notes) across the
 * top, then the chapter bar with its completion and the section's file rows,
 * then the lesson content. Everything functional is unchanged: the same
 * protected viewers, the same start-on-open (`onSelectLesson` is the page's
 * `handleOpenLesson`), and the same completion rules — VIDEO lessons complete
 * automatically by watch-through percentage (SYSTEM_PLAN.md §18) and never get
 * a manual button; every other type keeps "Mark as Completed", on the open
 * lesson's row only (a lesson can't be completed without being opened).
 */
export function LessonViewerModal({
  group,
  openLessonId,
  progress,
  progressError,
  isCompleting,
  onSelectLesson,
  onComplete,
  onRetryProgress,
  onClose,
}: {
  group: ModuleGroup | null;
  openLessonId: string | null;
  progress: LessonProgressResponse | undefined;
  progressError: unknown;
  isCompleting: boolean;
  onSelectLesson: (lessonId: string) => void;
  onComplete: (lessonId: string) => void;
  onRetryProgress: () => void;
  onClose: () => void;
}) {
  const entry = group?.entries.find((e) => e.lesson.id === openLessonId);
  if (!group || !entry) return null;

  const { lesson, status } = entry;
  const { label: typeLabel, icon: TypeIcon } = CONTENT_TYPE_META[lesson.content_type];
  const activeCategory = getLessonCategory(lesson);
  const categories = LESSON_CATEGORY_ORDER.filter((c) =>
    group.entries.some((e) => getLessonCategory(e.lesson) === c),
  );
  const sectionEntries = group.entries.filter(
    (e) => getLessonCategory(e.lesson) === activeCategory,
  );
  const completedAt = progress?.completed_at;

  function selectCategory(category: LessonCategory) {
    if (category === activeCategory) return;
    const first = group?.entries.find((e) => getLessonCategory(e.lesson) === category);
    if (first) onSelectLesson(first.lesson.id);
  }

  return (
    <Modal open onClose={onClose} title={lesson.title} size="xl">
      <div className="space-y-5">
        {categories.length > 1 && (
          <div className={`grid grid-cols-1 gap-4 ${CATEGORY_GRID_COLS[categories.length]}`}>
            {categories.map((category) => {
              const meta = LESSON_CATEGORY_META[category];
              return (
                <CategoryCard
                  key={category}
                  icon={meta.icon}
                  label={meta.label}
                  caption={meta.caption}
                  active={category === activeCategory}
                  onSelect={() => selectCategory(category)}
                />
              );
            })}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-950 px-4 py-3 text-white">
            <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <MinusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{group.title}</span>
            </p>
            <p className="text-sm font-semibold">Completed: {getGroupCompletionPct(group)}%/100%</p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-sm font-semibold text-indigo-950">
              Section: {LESSON_CATEGORY_META[activeCategory].caption}
            </p>
            <ul className="mt-3 divide-y divide-slate-100">
              {sectionEntries.map((row) => (
                <SectionRow
                  key={row.lesson.id}
                  entry={row}
                  selected={row.lesson.id === lesson.id}
                  isCompleting={isCompleting}
                  onSelect={() => onSelectLesson(row.lesson.id)}
                  onComplete={() => onComplete(row.lesson.id)}
                />
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="info">
              <TypeIcon className="mr-1 h-3 w-3" aria-hidden="true" />
              {typeLabel}
            </Badge>
            <Badge tone={lesson.is_required ? "warning" : "neutral"}>
              {lesson.is_required ? "Required" : "Optional"}
            </Badge>
            <Badge
              tone={
                status === "COMPLETED" ? "success" : status === "IN_PROGRESS" ? "info" : "neutral"
              }
            >
              {STATUS_LABEL[status]}
            </Badge>
          </div>

          {lesson.description && (
            <RichText value={lesson.description} className="mt-3 text-sm text-slate-600" />
          )}

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
            <LessonBody key={lesson.id} lesson={lesson} progress={progress} />

            {status === "COMPLETED" && (
              <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Completed
                {completedAt ? ` on ${new Date(completedAt).toLocaleDateString()}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** One file row in the section: icon + title on the left, completion state or action on the right. */
function SectionRow({
  entry,
  selected,
  isCompleting,
  onSelect,
  onComplete,
}: {
  entry: LessonEntry;
  selected: boolean;
  isCompleting: boolean;
  onSelect: () => void;
  onComplete: () => void;
}) {
  const { lesson, status } = entry;
  const { icon: Icon } = CONTENT_TYPE_META[lesson.content_type];
  // Only uploaded VIDEO lessons complete by watch-through (VideoLessonPlayer); an embedded
  // YouTube/Vimeo link has no watch tracking, so it keeps the manual button like any other type.
  const autoCompletes = lesson.content_type === "VIDEO";

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 py-3 ${selected ? "bg-indigo-50/60" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-1 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-sky-100 text-sky-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-indigo-950">
            {lesson.title}
          </span>
          <span className="text-xs text-slate-500">
            {lesson.is_required ? "Required" : "Optional"}
          </span>
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-2 pr-1">
        {entry.loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
        ) : status === "COMPLETED" ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Completed
          </span>
        ) : selected && !autoCompletes ? (
          <Button
            type="button"
            className="gap-1.5 px-4 py-2 text-xs"
            disabled={isCompleting}
            onClick={onComplete}
          >
            {isCompleting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Mark as Completed
          </Button>
        ) : (
          <span className="text-xs text-slate-500">
            {autoCompletes && selected ? "Completes as you watch" : STATUS_LABEL[status]}
          </span>
        )}
      </div>
    </li>
  );
}
