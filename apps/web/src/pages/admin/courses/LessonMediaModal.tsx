import { useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
import type { CourseLessonResponse, MediaAssetResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { getMediaAccessUrl, uploadCourseMedia } from "../../../services/api/media";
import { setCourseLessonMedia, updateCourseLesson } from "../../../services/api/courseLessons";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [uploaded, setUploaded] = useState<MediaAssetResponse | null>(null);
  // Automatic video duration extraction unit — detected once per file
  // selection, only for VIDEO-content lessons; null means either no video
  // file is selected or detection wasn't possible (see
  // detectVideoDurationSeconds's own doc comment).
  const [detectedDurationSeconds, setDetectedDurationSeconds] = useState<number | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["course-lessons", moduleId] });

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
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
    <Modal open={open} onClose={handleClose} title={`Media — ${lesson.title}`}>
      <div className="space-y-4">
        {lesson.media_asset_id && !removeMutation.isSuccess ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">A media file is attached.</p>
            {uploaded && (
              <p className="mt-1 text-xs text-slate-500">
                {uploaded.original_filename} · {uploaded.mime_type} ·{" "}
                {formatBytes(uploaded.size_bytes)}
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              className="mr-2 mt-2"
              disabled={viewMutation.isPending}
              onClick={() => viewMutation.mutate()}
            >
              {viewMutation.isPending ? "Opening…" : "View media"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="mt-2"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              {removeMutation.isPending ? "Removing…" : "Remove media"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No media is attached to this lesson yet.</p>
        )}

        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
          <UploadCloud className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
          <label htmlFor="lesson-media-file" className="mt-2 block text-sm text-slate-600">
            {lesson.media_asset_id ? "Upload a replacement file" : "Upload a file"}
          </label>
          <input
            id="lesson-media-file"
            type="file"
            className="mt-2 block w-full text-sm text-slate-600"
            onChange={(event) => void handleFileChange(event)}
          />
          {detectedDurationSeconds !== null && (
            <p className="mt-2 text-xs text-emerald-700">
              Detected duration: {formatDuration(detectedDurationSeconds)} — will be saved to this
              lesson's Duration field automatically (still editable there afterward).
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button
            type="button"
            disabled={!file || uploadMutation.isPending}
            onClick={() => file && uploadMutation.mutate(file)}
          >
            {uploadMutation.isPending ? "Uploading…" : "Upload & Attach"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
