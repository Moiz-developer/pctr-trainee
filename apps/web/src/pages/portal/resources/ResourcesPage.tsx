import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Eye, ExternalLink, FileText } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { Modal } from "../../../components/ui/Modal";
import { SelectField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listResourceCategories, listResources } from "../../../services/api/resources";
import { getSafeHttpsUrl } from "../../../lib/safeUrl";
import { ProtectedFileViewer } from "../courses/ProtectedFileViewer";
import { DOCX_MIME } from "../courses/DocumentLessonViewer";

const PDF_MIME = "application/pdf";

/** File types the portal can render itself; everything else has no preview and no download. */
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
 * through the in-portal viewer (PDF, DOCX and images). There is no generic
 * "View / Download" that opens the raw signed Storage URL; a file type the
 * portal can't render is shown as "Preview not available".
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

  return (
    <>
      <Button
        variant="secondary"
        className="gap-1.5 px-2 py-1 text-xs"
        onClick={() => setOpen(true)}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        View
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} wide>
        <ProtectedFileViewer mediaAssetId={mediaAssetId} mimeType={mimeType} />
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
  if (!safeUrl) return <span className="text-xs text-slate-400">Link unavailable</span>;
  return (
    <Button
      variant="secondary"
      className="gap-1.5 px-2 py-1 text-xs"
      onClick={() => window.open(safeUrl, "_blank", "noopener")}
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
                        ) : canPreviewInPortal(item.file_type) ? (
                          <InAppDocumentButton
                            mediaAssetId={item.media_asset_id!}
                            mimeType={item.file_type}
                            title={item.title}
                          />
                        ) : (
                          <span className="text-xs text-slate-400">Preview not available</span>
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
