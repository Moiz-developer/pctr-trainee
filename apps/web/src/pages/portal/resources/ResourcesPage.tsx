import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Eye, ExternalLink, FileText } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { Modal } from "../../../components/ui/Modal";
import { SelectField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { listResourceCategories, listResources } from "../../../services/api/resources";
import { getMediaAccessUrl } from "../../../services/api/media";
import { PdfLessonViewer } from "../courses/PdfLessonViewer";
import { DocumentLessonViewer, DOCX_MIME } from "../courses/DocumentLessonViewer";

const PDF_MIME = "application/pdf";
const DOC_MIME = "application/msword";

/**
 * Resource Library (SYSTEM_PLAN.md §4/§14.5/§20/§26): every PUBLISHED
 * resource the caller's department(s) can see (or a globally-visible one —
 * §14.5/§20's "empty department mapping = globally visible" rule),
 * server-filtered by `GET /resources` — never a client-side filter of a
 * broader fetched set (visibility is authorization, not presentation).
 * Category is an additional, purely presentational filter on top of that —
 * a server-side query param, not a substitute for the visibility check.
 *
 * Download restriction unit: a PDF/DOCX (or legacy DOC) resource now opens
 * in-app via InAppDocumentButton (reusing PdfLessonViewer/
 * DocumentLessonViewer exactly as course lessons already do) instead of a
 * direct "View / Download" new-tab open of the signed URL — this
 * DownloadButton is kept unchanged for every other file type (images,
 * spreadsheets, archives, etc.), for which no in-app viewer exists in this
 * codebase; that remains the safest existing behavior rather than inventing
 * a new document-conversion system.
 */
function DownloadButton({ mediaAssetId }: { mediaAssetId: string }) {
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: () => getMediaAccessUrl(mediaAssetId),
    onSuccess: (result) => {
      window.open(result.url, "_blank", "noopener");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to open the file.");
    },
  });

  return (
    <Button
      variant="secondary"
      className="gap-1.5 px-2 py-1 text-xs"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      {mutation.isPending ? "Opening…" : "View / Download"}
    </Button>
  );
}

/**
 * In-app viewer for a PDF/DOCX/DOC resource — opens the existing
 * PdfLessonViewer/DocumentLessonViewer inside a Modal (mirrors
 * PoliciesPage.tsx's own "View" + read-only Modal convention) instead of
 * offering a direct download link, satisfying "no download affordance for
 * recognized document formats" without touching either viewer component.
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

  return (
    <>
      <Button variant="secondary" className="gap-1.5 px-2 py-1 text-xs" onClick={() => setOpen(true)}>
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        View
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} wide>
        {mimeType === PDF_MIME ? (
          <PdfLessonViewer mediaAssetId={mediaAssetId} />
        ) : (
          <DocumentLessonViewer mediaAssetId={mediaAssetId} mimeType={mimeType} />
        )}
      </Modal>
    </>
  );
}

/**
 * Useful Links unit: a URL-backed resource (`external_url` set, no attached
 * media asset) needs no signed-URL round trip — `external_url` is already a
 * public link, returned as-is by the API (resources.ts's own schema
 * comment) — so this opens it directly, same `window.open(..., "_blank",
 * "noopener")` call DownloadButton already uses, just without the
 * intermediate `getMediaAccessUrl` mutation.
 */
function OpenLinkButton({ externalUrl }: { externalUrl: string }) {
  return (
    <Button
      variant="secondary"
      className="gap-1.5 px-2 py-1 text-xs"
      onClick={() => window.open(externalUrl, "_blank", "noopener")}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      View / Open Link
    </Button>
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
        <div className="mb-4 max-w-xs">
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">File Type</th>
                    <th className="py-2 pr-4">Uploaded</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="max-w-xs py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          {item.external_url ? (
                            <ExternalLink
                              className="h-3.5 w-3.5 shrink-0 text-slate-400"
                              aria-hidden="true"
                            />
                          ) : (
                            <FileText
                              className="h-3.5 w-3.5 shrink-0 text-slate-400"
                              aria-hidden="true"
                            />
                          )}
                          <div>
                            <p className="truncate font-medium text-slate-900">{item.title}</p>
                            {item.description && (
                              <p className="truncate text-xs text-slate-500">{item.description}</p>
                            )}
                            {/* Department visibility in the Trainer Portal UI
                                unit: empty = globally visible, so nothing is
                                rendered (mirrors CourseCard.tsx's identical
                                convention). */}
                            {item.departments.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.departments.map((department) => (
                                  <Badge key={department.id} tone="info">
                                    {department.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{item.category.name}</td>
                      <td className="py-3 pr-4 text-slate-500">{item.file_type}</td>
                      <td className="py-3 pr-4 text-slate-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4">
                        {item.external_url ? (
                          <OpenLinkButton externalUrl={item.external_url} />
                        ) : item.file_type === PDF_MIME ||
                          item.file_type === DOCX_MIME ||
                          item.file_type === DOC_MIME ? (
                          <InAppDocumentButton
                            mediaAssetId={item.media_asset_id!}
                            mimeType={item.file_type}
                            title={item.title}
                          />
                        ) : (
                          <DownloadButton mediaAssetId={item.media_asset_id!} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </RemoteDataView>

        {query.data && query.data.meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
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
        )}
      </Card>
    </div>
  );
}
