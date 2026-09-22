import { CheckCircle2, ClipboardList, Eye, Info, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { MediaImage } from "../../../components/shared/MediaImage";
import { getGroupStatus, isVideoLesson, STATUS_LABEL, type ModuleGroup } from "./courseLessonMeta";
import { RichText } from "../../../components/ui/RichText";

// The reference's task status pill: yellow while not started, blue in progress, green when done.
const STATUS_PILL_CLASS = {
  NOT_STARTED: "bg-amber-300 text-slate-900",
  IN_PROGRESS: "bg-blue-500 text-white",
  COMPLETED: "bg-emerald-600 text-white",
} as const;

/**
 * One practical task (a module's PRACTICAL lessons) as a card, per
 * practical.png: purple title bar, description, "Resources", and a status
 * pill. Videos have no block of their own: they play in the lesson viewer
 * the task opens (its "Videos" section), so they are not shown twice. Resources
 * open in the in-portal protected viewer — the reference's "Download" buttons are deliberately NOT
 * reproduced (downloads were removed by the security hardening). The
 * reference's Awaiting Feedback / Feedback / file-upload elements have no
 * backing data model, so they are not rendered.
 *
 * UI consistency unit: each resource button opens a document/file (via the shared lesson viewer
 * modal), so — like every other document-preview action in the portal — it uses the shared
 * `Button` component's default primary/purple styling, not a bespoke colour (the reference's own
 * alternating blue/orange scheme is not reproduced).
 */
export function PracticalTaskCard({
  group,
  onOpenLesson,
}: {
  group: ModuleGroup;
  onOpenLesson: (lessonId: string) => void;
}) {
  const status = getGroupStatus(group);
  const resources = group.entries.filter((e) => !isVideoLesson(e.lesson));

  return (
    <Card flush className="flex flex-col">
      <div className="bg-indigo-900 px-5 py-3">
        <h4 className="text-base font-semibold leading-snug text-white">{group.title}</h4>
      </div>

      {/* The module's own image (uploaded in the admin module form). Without one, the same
          branded gradient + icon placeholder the course and chapter cards use fills the box, so
          every task card keeps the same 16:9 cover. */}
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900 to-indigo-700 text-white/30">
        <MediaImage
          mediaAssetId={group.imageMediaId}
          className="h-full w-full object-cover"
          fallback={<ClipboardList className="h-14 w-14" aria-hidden="true" />}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {group.description && (
          <RichText value={group.description} className="text-sm text-slate-600" />
        )}

        {resources.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-indigo-950">Resources:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {resources.map((entry) => (
                <Button
                  key={entry.lesson.id}
                  type="button"
                  onClick={() => onOpenLesson(entry.lesson.id)}
                  title={entry.lesson.title}
                  className={`max-w-full gap-1.5 px-3 py-2 text-xs ${entry.isCurrent ? "ring-2 ring-indigo-300 ring-offset-1" : ""}`}
                >
                  {entry.loading ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                  ) : entry.status === "COMPLETED" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">{entry.lesson.title}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* A task with only videos has no resource buttons to open it by, so it gets one. */}
        {resources.length === 0 && (
          <Button
            className="w-full gap-1.5"
            onClick={() =>
              onOpenLesson((group.entries.find((e) => e.isCurrent) ?? group.entries[0]!).lesson.id)
            }
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            View Task
          </Button>
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
