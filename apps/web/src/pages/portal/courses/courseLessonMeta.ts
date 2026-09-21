import {
  AlignLeft,
  ExternalLink,
  File,
  FileText,
  PlayCircle,
  Presentation,
  Video,
  type LucideIcon,
} from "lucide-react";
import type {
  CourseDetailLesson,
  LessonContentType,
  LessonProgressStatus,
} from "@internal-training/shared";
import { DOCX_MIME } from "./DocumentLessonViewer";
import { getEmbeddableVideoUrl } from "./ExternalVideoPlayer";

export const STATUS_LABEL: Record<LessonProgressStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

/**
 * Visual distinction between lesson content types: an icon + a human-readable
 * label per `LessonContentType`. Purely presentational — content types and
 * behavior are unchanged.
 */
export const CONTENT_TYPE_META: Record<LessonContentType, { label: string; icon: LucideIcon }> = {
  VIDEO: { label: "Video", icon: Video },
  PDF: { label: "PDF", icon: FileText },
  DOCUMENT: { label: "Document", icon: File },
  PRESENTATION: { label: "Presentation", icon: Presentation },
  EXTERNAL_LINK: { label: "External Link", icon: ExternalLink },
  TEXT: { label: "Text", icon: AlignLeft },
};

/** One lesson plus the live, server-sourced state the cards need to render it. */
export interface LessonEntry {
  lesson: CourseDetailLesson;
  status: LessonProgressStatus;
  /** Its progress query is still loading, or opening it is starting it. */
  loading: boolean;
  /** The next lesson the trainee hasn't completed yet ("Continue here"). */
  isCurrent: boolean;
}

/** A module's lessons of one classification (THEORETICAL or PRACTICAL). */
export interface ModuleGroup {
  moduleId: string;
  title: string;
  description: string | null;
  imageMediaId: string | null;
  entries: LessonEntry[];
}

/**
 * The lessons that decide whether a chapter/task counts as done: its required
 * lessons, matching how the server computes course progress (§18 counts required
 * lessons only), or all of them when none is marked required.
 */
function getCountedEntries(group: ModuleGroup): LessonEntry[] {
  const required = group.entries.filter((e) => e.lesson.is_required);
  return required.length > 0 ? required : group.entries;
}

/** A chapter/task is complete once every counted lesson is. Derived from real per-lesson status. */
export function isGroupCompleted(group: ModuleGroup): boolean {
  const counted = getCountedEntries(group);
  return counted.length > 0 && counted.every((e) => e.status === "COMPLETED");
}

export function getGroupStatus(group: ModuleGroup): LessonProgressStatus {
  if (isGroupCompleted(group)) return "COMPLETED";
  return group.entries.some((e) => e.status !== "NOT_STARTED") ? "IN_PROGRESS" : "NOT_STARTED";
}

/** True for lessons that play as video (uploaded video, or a recognised YouTube/Vimeo link). */
export function isVideoLesson(lesson: CourseDetailLesson): boolean {
  if (lesson.content_type === "VIDEO") return true;
  return (
    lesson.content_type === "EXTERNAL_LINK" &&
    !!lesson.external_url &&
    getEmbeddableVideoUrl(lesson.external_url) !== null
  );
}

/** Which protected viewer renders a lesson's body. */
export type LessonViewerKind =
  "VIDEO" | "PDF" | "DOCX" | "LEGACY_DOC" | "PRESENTATION" | "IMAGE" | "INLINE" | "NO_MEDIA";

const PRESENTATION_MIMES = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

/**
 * Picks the viewer from the file's REAL type, not the lesson's label. A lesson
 * marked "PDF" can hold any uploaded document, and feeding a DOCX to pdf.js only
 * produces a misleading "PDF could not be loaded". `media_mime_type` (the stored
 * MIME the upload was validated against) decides; `content_type` is only the
 * fallback when no MIME is known. Every kind still renders through the same
 * signed-URL viewers — nothing here fetches or links a file.
 */
export function getLessonViewerKind(lesson: CourseDetailLesson): LessonViewerKind {
  if (lesson.content_type === "VIDEO") return "VIDEO";
  if (lesson.content_type === "TEXT" || lesson.content_type === "EXTERNAL_LINK") return "INLINE";
  if (!lesson.media_asset_id) return "NO_MEDIA";

  const mime = lesson.media_mime_type;
  if (mime === "application/pdf") return "PDF";
  if (mime === DOCX_MIME) return "DOCX";
  if (mime === "application/msword") return "LEGACY_DOC";
  if (mime && PRESENTATION_MIMES.has(mime)) return "PRESENTATION";
  if (mime?.startsWith("image/")) return "IMAGE";

  // No usable MIME: fall back to what the lesson says it is.
  if (lesson.content_type === "PDF") return "PDF";
  if (lesson.content_type === "PRESENTATION") return "PRESENTATION";
  return "LEGACY_DOC";
}

/** The reference's three chapter tabs: Presentation / Videos / Notes. */
export type LessonCategory = "PRESENTATION" | "VIDEO" | "NOTES";

export const LESSON_CATEGORY_META: Record<
  LessonCategory,
  { label: string; caption: string; icon: LucideIcon }
> = {
  PRESENTATION: { label: "Presentation", caption: "Presentation Files", icon: Presentation },
  VIDEO: { label: "Videos", caption: "Video Files", icon: PlayCircle },
  NOTES: { label: "Notes", caption: "Notes Files", icon: FileText },
};

export const LESSON_CATEGORY_ORDER: LessonCategory[] = ["PRESENTATION", "VIDEO", "NOTES"];

/** Presentations and videos have their own tab; PDFs, documents, text and links are Notes. */
export function getLessonCategory(lesson: CourseDetailLesson): LessonCategory {
  if (lesson.content_type === "PRESENTATION") return "PRESENTATION";
  if (isVideoLesson(lesson)) return "VIDEO";
  return "NOTES";
}

/** Whole-number percentage of a chapter's counted lessons that are completed (real per-lesson status). */
export function getGroupCompletionPct(group: ModuleGroup): number {
  const counted = getCountedEntries(group);
  if (counted.length === 0) return 0;
  const done = counted.filter((e) => e.status === "COMPLETED").length;
  return Math.round((done / counted.length) * 100);
}
