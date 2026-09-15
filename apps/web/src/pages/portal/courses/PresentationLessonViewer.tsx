import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Download } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { ApiClientError } from "../../../services/api/client";
import { getMediaAccessUrl } from "../../../services/api/media";

/**
 * PPT/PPTX lesson access. No small, well-maintained, purely-client-side
 * PPT/PPTX renderer comparable to pdf.js (PDF) or mammoth (DOCX) exists in
 * this stack, and none is added here (no new architecture/dependency) — so
 * this mirrors DocumentLessonViewer.tsx's own legacy-`.doc` fallback
 * exactly: an honest "can't preview in-app" message plus a secure download
 * action, not a fabricated preview.
 *
 * The download resolves a short-lived signed URL on demand via the
 * existing, unmodified `GET /media/:id/access-url` flow
 * (services/api/media.ts's `getMediaAccessUrl`) — the same authorization
 * `media.service.ts`'s `reachableViaLesson` check already grants for any of
 * this lesson's attached media regardless of content type/mime, so no
 * authorization/RLS change was needed. Never a stored or public link —
 * `window.open` is called only with the freshly-resolved signed URL, same
 * pattern already used by DocumentLessonViewer.tsx/ResourcesPage.tsx.
 */
export function PresentationLessonViewer({ mediaAssetId }: { mediaAssetId: string }) {
  const mutation = useMutation({
    mutationFn: () => getMediaAccessUrl(mediaAssetId),
    onSuccess: (result) => {
      window.open(result.url, "_blank", "noopener");
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Presentation files (PPT/PPTX) can't be previewed in-app — no safe, reliable in-browser
        renderer is available for this format. Download it to view it instead.
      </p>
      <div className="space-y-2">
        <Button
          variant="secondary"
          className="gap-1.5 px-2 py-1 text-xs"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {mutation.isPending ? "Opening…" : "Download"}
        </Button>
        {mutation.isError && (
          <div className="flex items-center gap-2 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {mutation.error instanceof ApiClientError
              ? mutation.error.message
              : "Couldn't download this presentation."}
          </div>
        )}
      </div>
    </div>
  );
}
