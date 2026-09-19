import { useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import type { CourseLessonResponse, MediaAssetResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { getMediaAccessUrl, uploadCourseMedia } from "../../../services/api/media";
import { setCourseLessonMedia, updateCourseLesson } from "../../../services/api/courseLessons";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Presentation-only hints shown in the file picker for each media-backed lesson type.
const ACCEPTED_HINT: Record<string, string> = {
  VIDEO: "Video files (MP4, WebM, MOV, AVI)",
  PDF: "PDF documents",
  DOCUMENT: "Word documents (DOC, DOCX)",
  PRESENTATION: "PowerPoint files (PPT, PPTX)",
};

function describeFileType(file: File): string {
  const extension = file.name.includes(".") ? file.name.split(".").pop() : undefined;
  return extension ? extension.toUpperCase() : file.type || "File";
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Automatic video duration extraction unit: reads the actual selected
 * file's duration entirely client-side via a detached `<video>` element +
 * a temporary `URL.createObjectURL` (never uploaded merely to measure it —
 * the object URL is local to this browser tab). Resolves `null` (never
 * throws) on any load/decode failure, so a corrupted/unrecognized file just
 * leaves the manual `duration_seconds` field alone rather than blocking the
 * upload.
 */
function detectVideoDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    function cleanup() {
      URL.revokeObjectURL(objectUrl);
    }

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
      cleanup();
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
  });
}

/**
 * Integrates the existing Supabase media workflow (Unit 2.8) exactly as
 * built: request a signed upload URL, PUT the bytes directly to Storage,
 * confirm, then attach the resulting media_asset id to the lesson. Never
 * touches Storage credentials or bypasses the signed-URL mechanism.
 *
 * There is no "get media asset by id" endpoint (only the user-facing,
 * effective-access-gated access-url endpoint), so once a media asset was
 * attached in an earlier session this modal can only show that *something*
 * is attached, not its original filename/size — see this unit's
 * implementation report.
 */
export function LessonMediaModal({
  open,
  onClose,
  courseId,
  moduleId,
  lesson,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  moduleId: string;
  lesson: CourseLessonResponse;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [uploaded, setUploaded] = useState<MediaAssetResponse | null>(null);
  // Automatic video duration extraction unit — detected once per file
  // selection, only for VIDEO-content lessons; null means either no video
  // file is selected or detection wasn't possible (see
  // detectVideoDurationSeconds's own doc comment).
  const [detectedDurationSeconds, setDetectedDurationSeconds] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["course-lessons", moduleId] });

  // Clears only the locally selected (not yet uploaded) file and any stale failed-upload state.
  function clearSelection() {
    uploadMutation.reset();
    setFile(null);
    setDetectedDurationSeconds(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (!uploadMutation.isPending) uploadMutation.reset();
    setFile(selected);
    setDetectedDurationSeconds(null);
    if (selected && lesson.content_type === "VIDEO" && selected.type.startsWith("video/")) {
      setDetectedDurationSeconds(await detectVideoDurationSeconds(selected));
    }
  }

  const uploadMutation = useMutation({
    mutationFn: async (selected: File) => {
      const asset = await uploadCourseMedia(selected);
      await setCourseLessonMedia(courseId, moduleId, lesson.id, asset.id);
      // Populates the existing duration_seconds field (SYSTEM_PLAN.md
      // §14.2, unchanged column/completion algorithm) — the admin can still
      // review/correct it afterward from LessonFormModal's own manual
      // field, which is untouched by this unit.
      if (detectedDurationSeconds !== null) {
        await updateCourseLesson(courseId, moduleId, lesson.id, {
          duration_seconds: detectedDurationSeconds,
        });
      }
      return asset;
    },
    onSuccess: () => {
      // Not awaited: the list refetch is slow and must not delay the
      // success feedback or keep the modal (and its stale `lesson` prop) open.
      void invalidate();
      toast.success("Media uploaded.");
      handleClose();
    },
    onError: (error) => {
      const fieldMessage =
        error instanceof ApiClientError ? Object.values(error.fields ?? {})[0]?.[0] : undefined;
      toast.error(
        fieldMessage ??
          (error instanceof ApiClientError ? error.message : "Upload failed. Please try again."),
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => setCourseLessonMedia(courseId, moduleId, lesson.id, null),
    onSuccess: async () => {
      setUploaded(null);
      setConfirmRemove(false);
      await invalidate();
      toast.success("Media removed.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to remove media.");
    },
  });

  const viewMutation = useMutation({
    mutationFn: () => getMediaAccessUrl(lesson.media_asset_id!),
    onSuccess: (result) => {
      window.open(result.url, "_blank", "noopener");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to open the media.");
    },
  });

  function handleClose() {
    setFile(null);
    setUploaded(null);
    setDetectedDurationSeconds(null);
    onClose();
  }

  return (
    <>
      <Modal open={open} onClose={handleClose} title={`Media — ${lesson.title}`}>
        <div className="space-y-4">
          {lesson.media_asset_id && !removeMutation.isSuccess ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-indigo-950">A media file is attached.</p>
                {uploaded && (
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {uploaded.original_filename} · {uploaded.mime_type} ·{" "}
                    {formatBytes(uploaded.size_bytes)}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    disabled={viewMutation.isPending}
                    onClick={() => viewMutation.mutate()}
                  >
                    {viewMutation.isPending ? "Opening…" : "View media"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="px-3 py-1.5 text-xs"
                    disabled={removeMutation.isPending}
                    onClick={() => setConfirmRemove(true)}
                  >
                    {removeMutation.isPending ? "Removing…" : "Remove media"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
              No media is attached to this lesson yet.
            </p>
          )}

          <div className="space-y-2">
            <label
              htmlFor="lesson-media-file"
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-indigo-900 ${
                uploadMutation.isError
                  ? "border-red-300 bg-red-50/60 hover:border-red-500"
                  : "border-indigo-200 bg-indigo-50/40 hover:border-indigo-900 hover:bg-indigo-50"
              } ${uploadMutation.isPending ? "pointer-events-none opacity-60" : ""}`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-indigo-900 shadow-sm">
                <UploadCloud className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-indigo-950">
                {file
                  ? "Choose a different file"
                  : lesson.media_asset_id
                    ? "Choose a replacement file"
                    : "Choose a file to upload"}
              </span>
              <span className="text-xs text-slate-500">
                {ACCEPTED_HINT[lesson.content_type] ??
                  "PDF, Word, PowerPoint, video or image files"}
              </span>
              <span className="mt-1 inline-flex items-center rounded-md bg-indigo-900 px-3 py-1.5 text-xs font-medium text-white">
                Browse files
              </span>
              <input
                ref={inputRef}
                id="lesson-media-file"
                type="file"
                className="sr-only"
                disabled={uploadMutation.isPending}
                onChange={(event) => void handleFileChange(event)}
              />
            </label>

            {uploadMutation.isError && !uploadMutation.isPending && (
              <p className="text-xs font-medium text-red-600">
                Upload failed — check the file and try again.
              </p>
            )}

            {file && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-900">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {describeFileType(file)} · {formatBytes(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={uploadMutation.isPending}
                    title="Remove selected file"
                    aria-label="Remove selected file"
                    className="cursor-pointer rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {uploadMutation.isPending && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-indigo-100">
                      <div className="h-full w-1/3 animate-[global-progress-bar_1.1s_ease-in-out_infinite] rounded-full bg-indigo-900" />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">Uploading and attaching…</p>
                  </div>
                )}
              </div>
            )}

            {detectedDurationSeconds !== null && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Detected duration: {formatDuration(detectedDurationSeconds)} — will be saved to this
                lesson's Duration field automatically (still editable there afterward).
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Close
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={!file || uploadMutation.isPending}
              onClick={() => file && uploadMutation.mutate(file)}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
              )}
              {uploadMutation.isPending ? "Uploading…" : "Upload & Attach"}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmRemove}
        title="Remove media"
        description="This detaches the file from the lesson. Trainees will no longer be able to view it. You can upload another file afterwards."
        confirmLabel="Remove"
        isPending={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate()}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
}
