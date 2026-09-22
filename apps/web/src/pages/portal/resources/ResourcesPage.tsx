import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Tag,
} from "lucide-react";
import type { ResourceResponse } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { SelectField } from "../../../components/ui/FormField";
import { useToast } from "../../../components/ui/Toast";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listResourceCategories, listResources } from "../../../services/api/resources";
import { getMediaAccessUrl } from "../../../services/api/media";
import { ApiClientError } from "../../../services/api/client";
import { getSafeHttpsUrl } from "../../../lib/safeUrl";
import { ProtectedFileViewer } from "../courses/ProtectedFileViewer";
import { usePdfModalSizing } from "../courses/pdfModalSizing";
import { DOCX_MIME } from "../courses/DocumentLessonViewer";
import { Chip, THUMBNAIL_BOX_CLASS } from "../courses/CourseCard";
import { richTextToPlain } from "../../../lib/richText";

const PDF_MIME = "application/pdf";

/**
 * File types the portal can render itself. Anything else has no in-app preview — Excel
 * (.xls/.xlsx) included: no already-installed dependency can parse either the modern
 * spreadsheetml zip format or the legacy binary format client-side (mammoth only implements
 * Word's wordprocessingml converter), and browsers have no built-in spreadsheet renderer. Adding
 * real preview would need a new package, so — same as legacy `.doc` below it — this is left
 * honestly unsupported rather than faked; see Business Analysis Templates unit's audit.
 */
function canPreviewInPortal(mimeType: string): boolean {
  return mimeType === PDF_MIME || mimeType === DOCX_MIME || mimeType.startsWith("image/");
}

/**
 * Resource Library (SYSTEM_PLAN.md §4/§14.5/§20/§26): every PUBLISHED
 * resource the caller's department(s) can see (or a globally-visible one —
 * §14.5/§20's "empty department mapping = globally visible" rule),
 * server-filtered by `GET /resources` — never a client-side filter of a
 * broader fetched set (visibility is authorization, not presentation).
 * Category is an additional, purely presentational filter on top of that —
 * a server-side query param, not a substitute for the visibility check.
 *
 * Security & download restrictions: a resource file is only ever opened
 * through the in-portal viewer (PDF, DOCX and images), or — Business Analysis
 * Templates unit — through `DownloadResourceButton` below, and only for a
 * resource the admin explicitly flagged `is_downloadable` (a template
 * trainees are meant to fill in and return, not a reference document). Every
 * other file type the portal can't render is shown as "Preview not
 * available"; there is still no generic "open the raw signed Storage URL"
 * affordance for anything else.
 */
/**
 * In-app viewer for a previewable resource — opens the shared
 * ProtectedFileViewer inside a Modal (mirrors
 * PoliciesPage.tsx's own "View" + read-only Modal convention) instead of
 * offering a direct download link, satisfying "no download affordance for
 * recognized document formats".
 */
function InAppDocumentButton({
  mediaAssetId,
  mimeType,
  title,
}: {
  mediaAssetId: string;
  mimeType: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  // Sizes the modal to the PDF's page (shared with every PDF modal, see pdfModalSizing.ts).
  const pdfFit = usePdfModalSizing();

  return (
    <>
      <Button className="w-full gap-1.5" onClick={() => setOpen(true)}>
        <Eye className="h-4 w-4" aria-hidden="true" />
        View
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        wide
        size={pdfFit.size ?? (mimeType === PDF_MIME ? "xl" : undefined)}
        maxWidth={pdfFit.maxWidth}
      >
        <ProtectedFileViewer
          mediaAssetId={mediaAssetId}
          mimeType={mimeType}
          pdfProps={pdfFit.viewerProps}
        />
      </Modal>
    </>
  );
}

/**
 * Useful Links unit: a URL-backed resource (`external_url` set, no attached
 * media asset) needs no signed-URL round trip — `external_url` is already a
 * public link, returned as-is by the API (resources.ts's own schema
 * comment) — so this opens it directly with `window.open(..., "_blank",
 * "noopener")`, after the https-only guard below.
 */
function OpenLinkButton({ externalUrl }: { externalUrl: string }) {
  // Only https links are ever opened, even if a legacy row holds another scheme.
  const safeUrl = getSafeHttpsUrl(externalUrl);
  if (!safeUrl) return <p className="text-center text-xs text-slate-400">Link unavailable</p>;
  return (
    <Button className="w-full gap-1.5" onClick={() => window.open(safeUrl, "_blank", "noopener")}>
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      View / Open Link
    </Button>
  );
}

/**
 * Business Analysis Templates unit: the one Download affordance in the Resource Library, shown
 * only for a resource the admin explicitly marked `is_downloadable` (a template trainees are
 * meant to fill in and return, not a reference document — see the audit's finding that no
 * resource has ever had a download link before this). Reuses the exact same authorized
 * `GET /media/:id/access-url` signed-URL flow every viewer in the portal already goes through —
 * no new access path, no raw Storage URL, no change to who can reach the file. A file with no
 * in-app preview (Excel, legacy `.doc`) is still downloadable this way even though it can't be
 * viewed first.
 */
function DownloadResourceButton({ mediaAssetId }: { mediaAssetId: string }) {
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: () => getMediaAccessUrl(mediaAssetId),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener"),
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to download the file.");
    },
  });

  return (
    <Button
      variant="secondary"
      className="w-full gap-1.5"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {mutation.isPending ? "Preparing…" : "Download"}
    </Button>
  );
}

/**
 * One resource card, laid out like CourseCard.tsx (same Card, thumbnail box,
 * text hierarchy, chips and full-width action). Resources have no thumbnail, so
 * the box shows the same file/link icon the table row used.
 */
function ResourceCard({ item }: { item: ResourceResponse }) {
  const ThumbIcon = item.external_url ? ExternalLink : FileText;
  return (
    <Card flush className="card-slide-scope flex flex-col">
      <div className={THUMBNAIL_BOX_CLASS}>
        <ThumbIcon className="h-14 w-14" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-sm font-semibold leading-snug text-indigo-950">{item.title}</h3>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
            {richTextToPlain(item.description)}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip icon={<Tag className="h-3 w-3" aria-hidden="true" />}>{item.category.name}</Chip>
          {/* Department visibility in the Trainer Portal UI unit: empty =
              globally visible, so nothing is rendered (mirrors CourseCard.tsx's
              identical convention). */}
          {item.departments.map((department) => (
            <Chip key={department.id} icon={<Building2 className="h-3 w-3" aria-hidden="true" />}>
              {department.name}
            </Chip>
          ))}
          <Chip icon={<FileText className="h-3 w-3" aria-hidden="true" />}>{item.file_type}</Chip>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Uploaded {new Date(item.created_at).toLocaleDateString()}
        </p>

        <div className="mt-4 flex-1" />
        {item.external_url ? (
          <OpenLinkButton externalUrl={item.external_url} />
        ) : (
          <div className="space-y-2">
            {canPreviewInPortal(item.file_type) ? (
              <InAppDocumentButton
                mediaAssetId={item.media_asset_id!}
                mimeType={item.file_type}
                title={item.title}
              />
            ) : !item.is_downloadable ? (
              <p className="text-center text-xs text-slate-400">Preview not available</p>
            ) : null}
            {/* Business Analysis Templates unit: independent of the preview above — a template
                can be downloadable whether or not it also has an in-app preview. */}
            {item.is_downloadable && <DownloadResourceButton mediaAssetId={item.media_asset_id!} />}
          </div>
        )}
      </div>
    </Card>
  );
}

export function ResourcesPage() {
  const [page, setPage] = useState(1);
  const [categoryId, setCategoryId] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["resource-categories"],
    queryFn: listResourceCategories,
  });

  const query = useQuery({
    queryKey: ["resources", page, categoryId],
    queryFn: () => listResources({ page, pageSize: 20, category_id: categoryId || undefined }),
  });

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Resources</h2>
        <p className="mt-1 text-sm text-slate-500">
          Reference documents and files made available to you.
        </p>
      </div>

      <Card>
        <div className="max-w-xs">
          <SelectField
            label="Category"
            id="filter-category"
            value={categoryId}
            onChange={(event) => handleCategoryChange(event.target.value)}
          >
            <option value="">All categories</option>
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>

      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data?.data}
        onRetry={() => void query.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle="No resources available"
        emptyDescription="Check back later, or try a different category."
      >
        {(items) => (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => (
              <ResourceCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </RemoteDataView>

      {query.data && query.data.meta.totalPages > 1 && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Page {query.data.meta.page} of {query.data.meta.totalPages} ·{" "}
              {query.data.meta.totalItems} total
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="gap-1 px-2 py-1 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-1 px-2 py-1 text-xs"
                disabled={page >= query.data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
