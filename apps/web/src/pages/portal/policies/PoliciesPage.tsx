import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import type { PolicyResponse } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { Modal } from "../../../components/ui/Modal";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listPolicies } from "../../../services/api/policies";
import { PdfLessonViewer } from "../courses/PdfLessonViewer";
import { DocumentLessonViewer } from "../courses/DocumentLessonViewer";

const PDF_MIME = "application/pdf";

/**
 * Policy & Procedures (SYSTEM_PLAN.md §4/§14.8/§23/§26): every policy that
 * currently has an active version — server-filtered by `GET /policies`,
 * never a client-side hide of a broader fetched set.
 *
 * Download restriction unit: a version with an attached PDF/DOCX (or
 * legacy DOC) document now opens in-app via PdfLessonViewer/
 * DocumentLessonViewer inside a read-only Modal — the exact same pattern
 * already used here for inline `content` — instead of resolving a signed
 * URL and opening it in a new tab. `media_mime_type` (added alongside this
 * unit, packages/shared/src/api/policies.ts) is what makes that choice
 * possible; a version with only inline `content` (no document) still opens
 * the same read-only text modal as before.
 */
function ViewButton({ version }: { version: PolicyResponse["active_version"] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" className="gap-1.5 px-2 py-1 text-xs" onClick={() => setOpen(true)}>
        <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
        View
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Policy Content" wide>
        {version.media_asset_id ? (
          version.media_mime_type === PDF_MIME ? (
            <PdfLessonViewer mediaAssetId={version.media_asset_id} />
          ) : (
            <DocumentLessonViewer
              mediaAssetId={version.media_asset_id}
              mimeType={version.media_mime_type}
            />
          )
        ) : (
          <p className="whitespace-pre-wrap text-sm text-slate-700">{version.content}</p>
        )}
      </Modal>
    </>
  );
}

export function PoliciesPage() {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["policies", page],
    queryFn: () => listPolicies({ page, pageSize: 20 }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <ScrollText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Policy & Procedures</h2>
          <p className="mt-1 text-sm text-slate-500">
            The current version of every published policy.
          </p>
        </div>
      </div>

      <Card className="border-t-4 border-amber-400">
        <RemoteDataView
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data?.data}
          onRetry={() => void query.refetch()}
          isEmpty={(items) => items.length === 0}
          emptyTitle="No policies available"
          emptyDescription="Check back later."
        >
          {(items) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Policy</th>
                    <th className="py-2 pr-4">Version</th>
                    <th className="py-2 pr-4">Effective Date</th>
                    <th className="py-2 pr-4">Last Updated</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="max-w-sm py-3 pr-4">
                        <div className="flex items-start gap-2">
                          <ScrollText
                            className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{item.title}</p>
                            {item.description && (
                              <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone="info">{item.active_version.version_label}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                          {new Date(item.active_version.effective_date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {new Date(item.active_version.updated_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4">
                        <ViewButton version={item.active_version} />
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
