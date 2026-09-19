import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { LessonProgressResponse } from "@internal-training/shared";
import { ApiClientError } from "../../../services/api/client";
import { getMediaAccessUrl } from "../../../services/api/media";
import { updateLessonProgress } from "../../../services/api/lessonProgress";
import { getVideoCompletionThreshold } from "../../../services/api/settings";

/**
 * Fallback video "watched" completion threshold (SYSTEM_PLAN.md §18: "video
 * lessons reach ≥ a configurable watch-through threshold (default 90%, from
 * `system_settings`)"). The real, admin-editable value now comes from
 * `GET /settings/video-completion-threshold` (Admin Portal / System
 * Settings unit) — this constant is used only until that fetch resolves
 * (or if it fails), so a video never fails to play/complete while waiting
 * on a settings round trip. It equals the exact same 0.9 this component
 * used to hard-code, so behavior is unchanged whenever settings are at
 * their default.
 */
const FALLBACK_VIDEO_COMPLETION_THRESHOLD = 0.9;

/** How often a periodic (non-pause, non-completion) position update may be sent, in ms. Matches §18's "e.g. every 10s". */
const POSITION_UPDATE_INTERVAL_MS = 10_000;

/**
 * Real `<video>` playback for VIDEO-content lessons (SYSTEM_PLAN.md §18
 * "Video resume" + completion rule), wired to the existing, unmodified
 * media access-url flow (`GET /media/:id/access-url`, Unit 2.8) and lesson
 * progress API (`PATCH /progress/lessons/:id`, Unit 2D) — no backend
 * changes were needed for this unit; see this unit's implementation report.
 *
 * - **Restore position**: seeks to the persisted `video_position_seconds`
 *   once, on `loadedmetadata`.
 * - **Update safely / avoid excessive writes**: `timeupdate` fires many
 *   times a second, so a periodic position PATCH is throttled to at most
 *   once per `POSITION_UPDATE_INTERVAL_MS`; `pause` flushes one immediately
 *   regardless of the throttle (a natural "the user stopped watching"
 *   moment), and only when the position actually changed since the last
 *   send — never a write with nothing new to persist.
 * - **Completion**: per §18, a video lesson's completion is driven by
 *   watch-through percentage against the lesson's authoritative
 *   `duration_seconds` (§14.2), NOT a manual "Mark Complete" click (that
 *   stays TEXT/EXTERNAL_LINK-only — see CourseDetailPage.tsx) — fired
 *   exactly once per mount via `hasAutoCompletedRef`, combined into a single
 *   PATCH with the position update rather than two separate writes.
 * - **Ownership/authorization**: unchanged — every request still goes
 *   through the same authenticated `apiFetch` (the caller's own session)
 *   and the same server-side `loadAuthorizedLesson` checks as every other
 *   progress operation; nothing here can act as, or on, another user.
 */
export function VideoLessonPlayer({
  lessonId,
  mediaAssetId,
  authoritativeDurationSeconds,
  progress,
}: {
  lessonId: string;
  mediaAssetId: string;
  authoritativeDurationSeconds: number | null;
  /**
   * The lesson's current progress from the parent's query cache — reactive,
   * not a one-time snapshot: it re-renders this component with fresh data
   * after every successful mutation (this component's own, via the shared
   * `["lesson-progress", lessonId]` cache key). Used once (guarded by
   * `hasSeekedRef`) to restore playback position on load, and continuously
   * to drive the live watch-percentage display below.
   */
  progress: LessonProgressResponse;
}) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasSeekedRef = useRef(false);
  const hasAutoCompletedRef = useRef(progress.status === "COMPLETED");
  const lastSentSecondsRef = useRef(progress.video_position_seconds);
  const lastSentAtRef = useRef(0);
  // Set while a signed-URL refresh is in flight so playback resumes where it left off.
  const resumeAtRef = useRef<number | null>(null);
  const resumePlayingRef = useRef(false);
  const lastRefreshRef = useRef(0);

  // The signed URL is short-lived (server-capped at 30 min) and is refreshed
  // ONLY on demand (see refreshAccessUrl): never on window focus or a timer,
  // because a new URL would swap the <video> source and restart playback.
  const accessUrlQuery = useQuery({
    queryKey: ["media-access-url", mediaAssetId],
    queryFn: () => getMediaAccessUrl(mediaAssetId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const thresholdQuery = useQuery({
    queryKey: ["video-completion-threshold"],
    queryFn: getVideoCompletionThreshold,
  });
  const completionThreshold =
    thresholdQuery.data?.video_completion_threshold ?? FALLBACK_VIDEO_COMPLETION_THRESHOLD;

  const progressMutation = useMutation({
    mutationFn: (input: { video_position_seconds?: number; status?: "COMPLETED" }) =>
      updateLessonProgress(lessonId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(["lesson-progress", lessonId], data);
      // On auto-completion, the server has recomputed course_progress in the
      // same transaction (§18) — refetch the (unknown-here) course detail so
      // its embedded progress bar picks up the new state.
      if (data.status === "COMPLETED") {
        void queryClient.invalidateQueries({ queryKey: ["user-course-detail"] });
      }
    },
  });

  // Reset per-mount guards if the caller re-renders this player for a
  // different lesson (module list is stable, but stay defensive).
  useEffect(() => {
    hasSeekedRef.current = false;
    hasAutoCompletedRef.current = progress.status === "COMPLETED";
    lastSentSecondsRef.current = progress.video_position_seconds;
    lastSentAtRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  function maybeReportPosition(currentSeconds: number, force: boolean) {
    if (currentSeconds === lastSentSecondsRef.current) return;
    const now = Date.now();
    if (!force && now - lastSentAtRef.current < POSITION_UPDATE_INTERVAL_MS) return;
    if (progressMutation.isPending) return;

    lastSentSecondsRef.current = currentSeconds;
    lastSentAtRef.current = now;
    progressMutation.mutate({ video_position_seconds: currentSeconds });
  }

  // Re-authorizes through the same access-url API when the signed URL has
  // expired (or is about to). At most once per 30s so a persistent failure
  // can't loop; the server re-checks authorization on every call.
  function refreshAccessUrl() {
    const video = videoRef.current;
    if (!video) return;
    const now = Date.now();
    if (now - lastRefreshRef.current < 30_000) return;
    lastRefreshRef.current = now;
    resumeAtRef.current = video.currentTime;
    resumePlayingRef.current = !video.paused;
    void accessUrlQuery.refetch();
  }

  function handlePlay() {
    const expiresAt = accessUrlQuery.data?.expires_at;
    if (expiresAt && Date.parse(expiresAt) - Date.now() < 30_000) refreshAccessUrl();
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (video && resumeAtRef.current !== null) {
      // The source was just swapped for a refreshed signed URL: continue from where playback was.
      video.currentTime = resumeAtRef.current;
      resumeAtRef.current = null;
      if (resumePlayingRef.current) void video.play().catch(() => undefined);
      return;
    }
    if (!video || hasSeekedRef.current) return;
    hasSeekedRef.current = true;
    if (progress.video_position_seconds > 0 && progress.status !== "COMPLETED") {
      video.currentTime = progress.video_position_seconds;
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    const currentSeconds = Math.floor(video.currentTime);
    const duration = authoritativeDurationSeconds ?? video.duration;

    if (
      !hasAutoCompletedRef.current &&
      duration &&
      Number.isFinite(duration) &&
      duration > 0 &&
      currentSeconds / duration >= completionThreshold &&
      !progressMutation.isPending
    ) {
      hasAutoCompletedRef.current = true;
      lastSentSecondsRef.current = currentSeconds;
      lastSentAtRef.current = Date.now();
      progressMutation.mutate({ video_position_seconds: currentSeconds, status: "COMPLETED" });
      return;
    }

    maybeReportPosition(currentSeconds, false);
  }

  function handlePause() {
    const video = videoRef.current;
    if (!video) return;
    maybeReportPosition(Math.floor(video.currentTime), true);
  }

  if (accessUrlQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading video…
      </div>
    );
  }

  if (accessUrlQuery.isError) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-red-600">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {accessUrlQuery.error instanceof ApiClientError
          ? accessUrlQuery.error.message
          : "Couldn't load this video."}
        <button
          type="button"
          className="cursor-pointer font-medium underline"
          onClick={() => void accessUrlQuery.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  const watchPct =
    authoritativeDurationSeconds && authoritativeDurationSeconds > 0
      ? Math.min(
          100,
          Math.round((progress.video_position_seconds / authoritativeDurationSeconds) * 100),
        )
      : null;

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        src={accessUrlQuery.data?.url}
        controls
        controlsList="nodownload"
        disablePictureInPicture
        disableRemotePlayback
        onContextMenu={(event) => event.preventDefault()}
        className="protected-content w-full rounded-lg bg-black"
        onError={refreshAccessUrl}
        onPlay={handlePlay}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPause={handlePause}
      />
      {watchPct !== null && progress.status !== "COMPLETED" && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
            <div className="h-full rounded-full bg-indigo-900" style={{ width: `${watchPct}%` }} />
          </div>
          <p className="text-xs text-slate-500">
            {watchPct}% watched — completes automatically at {Math.round(completionThreshold * 100)}
            %
          </p>
        </div>
      )}
      {progressMutation.isError && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {progressMutation.error instanceof ApiClientError
            ? progressMutation.error.message
            : "Failed to save video progress."}
        </div>
      )}
    </div>
  );
}
