import {
  AlignLeft,
  ExternalLink,
  File,
  FileText,
  Presentation,
  Video,
  type LucideIcon,
} from "lucide-react";
import type {
  CourseDetailLesson,
  LessonContentType,
  LessonProgressStatus,
} from "@internal-training/shared";
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
  entries: LessonEntry[];
}

/** A chapter/task is complete only when every lesson in it is. Derived from real per-lesson status. */
export function isGroupCompleted(group: ModuleGroup): boolean {
  return group.entries.length > 0 && group.entries.every((e) => e.status === "COMPLETED");
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
