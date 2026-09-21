import { BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { MediaImage } from "../../../components/shared/MediaImage";
import {
  CONTENT_TYPE_META,
  isGroupCompleted,
  type LessonEntry,
  type ModuleGroup,
} from "./courseLessonMeta";

/** The chapter's lessons as chips ("Presentation / Video / Notes" in the reference); a repeated type is numbered. */
function chipLabels(entries: LessonEntry[]): string[] {
  const totals = new Map<string, number>();
  for (const { lesson } of entries) {
    totals.set(lesson.content_type, (totals.get(lesson.content_type) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return entries.map(({ lesson }) => {
    const base = CONTENT_TYPE_META[lesson.content_type].label;
    if ((totals.get(lesson.content_type) ?? 0) < 2) return base;
    const n = (seen.get(lesson.content_type) ?? 0) + 1;
    seen.set(lesson.content_type, n);
    return `${base} ${n}`;
  });
}

function LessonChip({
  entry,
  label,
  onOpen,
}: {
  entry: LessonEntry;
  label: string;
  onOpen: () => void;
}) {
  const { icon: Icon } = CONTENT_TYPE_META[entry.lesson.content_type];
  const completed = entry.status === "COMPLETED";
  return (
    <button
      type="button"
      onClick={onOpen}
      title={entry.lesson.title}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs transition-colors ${
        completed
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400"
          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-900 hover:text-indigo-900"
      } ${entry.isCurrent ? "ring-2 ring-indigo-300" : ""}`}
    >
      {entry.loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : completed ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}

/**
 * One theoretical chapter (a module's THEORETICAL lessons) as a card, per
 * theory.png: cover, title, Completed/Incompleted pill, then one chip per
 * lesson. The pill is derived from the real per-lesson progress the page
 * already loads — it is never stored or computed separately. The cover is the
 * module's own image when one was uploaded, otherwise the branded placeholder
 * the course catalogue cards use.
 */
export function CourseChapterCard({
  group,
  onOpenLesson,
}: {
  group: ModuleGroup;
  onOpenLesson: (lessonId: string) => void;
}) {
  const completed = isGroupCompleted(group);
  const labels = chipLabels(group.entries);

  return (
    <Card flush className="flex flex-col">
      <div className="flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900 to-indigo-700 text-white/30">
        <MediaImage
          mediaAssetId={group.imageMediaId}
          className="h-full w-full object-cover"
          fallback={<BookOpen className="h-12 w-12" aria-hidden="true" />}
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h4 className="min-h-10 text-sm font-semibold leading-snug text-indigo-950">
          {group.title}
        </h4>
        <div className="mt-4">
          <Badge tone={completed ? "success" : "danger"} solid>
            {completed ? "Completed" : "Incompleted"}
          </Badge>
        </div>
        <div className="mt-4 flex-1" />
        <div className="flex flex-wrap gap-2">
          {group.entries.map((entry, index) => (
            <LessonChip
              key={entry.lesson.id}
              entry={entry}
              label={labels[index]!}
              onOpen={() => onOpenLesson(entry.lesson.id)}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
