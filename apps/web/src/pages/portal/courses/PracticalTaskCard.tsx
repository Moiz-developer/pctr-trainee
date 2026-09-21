import { CheckCircle2, ClipboardList, Eye, Info, Loader2, Play } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { MediaImage } from "../../../components/shared/MediaImage";
import {
  getGroupStatus,
  isVideoLesson,
  STATUS_LABEL,
  type LessonEntry,
  type ModuleGroup,
} from "./courseLessonMeta";
import { RichText } from "../../../components/ui/RichText";

// The reference's task status pill: yellow while not started, blue in progress, green when done.
const STATUS_PILL_CLASS = {
  NOT_STARTED: "bg-amber-300 text-slate-900",
  IN_PROGRESS: "bg-blue-500 text-white",
  COMPLETED: "bg-emerald-600 text-white",
} as const;

// The reference colours its two resource buttons blue and orange; alternated by position.
const RESOURCE_BUTTON_CLASS = [
  "bg-blue-600 hover:bg-blue-500",
  "bg-orange-500 hover:bg-orange-400",
];

function VideoTile({ entry, onOpen }: { entry: LessonEntry; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={entry.lesson.title}
      aria-label={`Play ${entry.lesson.title}`}
      className="group relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded bg-gradient-to-br from-indigo-950 to-indigo-800"
    >
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/40 px-3 py-1.5 text-left text-xs font-medium text-white">
        {entry.lesson.title}
      </span>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-indigo-900 transition-transform group-hover:scale-105">
        {entry.loading ? (
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        ) : entry.status === "COMPLETED" ? (
          <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden="true" />
        ) : (
          <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}

/**
 * One practical task (a module's PRACTICAL lessons) as a card, per
 * practical.png: purple title bar, description, "Resources", "Video
 * Explanation", and a status pill. Resources open in the in-portal protected
 * viewer — the reference's "Download" buttons are deliberately NOT
 * reproduced (downloads were removed by the security hardening). The
 * reference's Awaiting Feedback / Feedback / file-upload elements have no
 * backing data model, so they are not rendered.
 */
export function PracticalTaskCard({
  group,
  onOpenLesson,
}: {
  group: ModuleGroup;
  onOpenLesson: (lessonId: string) => void;
}) {
  const status = getGroupStatus(group);
  const videos = group.entries.filter((e) => isVideoLesson(e.lesson));
  const resources = group.entries.filter((e) => !isVideoLesson(e.lesson));

  return (
    <Card flush className="flex flex-col">
      <div className="bg-indigo-900 px-5 py-3">
        <h4 className="text-base font-semibold leading-snug text-white">{group.title}</h4>
      </div>

      {/* The module's own image (uploaded in the admin module form), when it has one — the same
          cover the theory chapter cards show. A task without an image keeps the card as it was. */}
      {group.imageMediaId && (
        <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900 to-indigo-700 text-white/30">
          <MediaImage
            mediaAssetId={group.imageMediaId}
            className="h-full w-full object-cover"
            fallback={<ClipboardList className="h-12 w-12" aria-hidden="true" />}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 p-5">
        {group.description && (
          <RichText value={group.description} className="text-sm text-slate-600" />
        )}

        {resources.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-indigo-950">Resources:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {resources.map((entry, index) => (
                <button
                  key={entry.lesson.id}
                  type="button"
                  onClick={() => onOpenLesson(entry.lesson.id)}
                  title={entry.lesson.title}
                  className={`inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded px-3 py-2 text-xs font-medium text-white transition-colors ${
                    RESOURCE_BUTTON_CLASS[index % RESOURCE_BUTTON_CLASS.length]
                  } ${entry.isCurrent ? "ring-2 ring-indigo-300 ring-offset-1" : ""}`}
                >
                  {entry.loading ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                  ) : entry.status === "COMPLETED" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">{entry.lesson.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {videos.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-indigo-950">Video Explanation:</p>
            <div className="mt-2 space-y-3">
              {videos.map((entry) => (
                <VideoTile
                  key={entry.lesson.id}
                  entry={entry}
                  onOpen={() => onOpenLesson(entry.lesson.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto space-y-2">
          <p
            className={`rounded-full px-3 py-1.5 text-center text-xs font-semibold ${STATUS_PILL_CLASS[status]}`}
          >
            Status : {STATUS_LABEL[status]}
          </p>
          {status !== "COMPLETED" && (
            <p className="flex items-start gap-2 rounded bg-indigo-50 px-3 py-2 text-xs text-slate-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-slate-800">Tip:</strong> Open each item above.
                Resources can be marked complete once you have finished them; videos complete
                automatically as you watch.
              </span>
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
