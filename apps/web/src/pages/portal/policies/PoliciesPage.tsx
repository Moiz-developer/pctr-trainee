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
import { DocumentPreviewButton } from "../courses/DocumentPreviewButton";
import { RichText } from "../../../components/ui/RichText";
import { richTextToPlain } from "../../../lib/richText";

const VIEW_BUTTON_CLASS = "gap-1.5 px-2 py-1 text-xs";

/**
 * Policy & Procedures (SYSTEM_PLAN.md §4/§14.8/§23/§26): every policy that
 * currently has an active version — server-filtered by `GET /policies`,
 * never a client-side hide of a broader fetched set.
 *
 * Download restriction unit: a version with an attached document opens
 * in-app via the shared `DocumentPreviewButton` (UI consistency unit — the
 * same "View" button + Modal + ProtectedFileViewer pattern ResourcesPage.tsx
 * uses) instead of resolving a signed URL and opening it in a new tab. A
 * version with only inline `content` (no document) instead opens the
 * read-only text modal below — same View button, same size, just no file to
 * hand to the protected viewer.
 */
function ViewButton({ version }: { version: PolicyResponse["active_version"] }) {
  if (version.media_asset_id) {
    return (
      <DocumentPreviewButton
        mediaAssetId={version.media_asset_id}
        mimeType={version.media_mime_type}
        title="Policy Content"
        icon={ScrollText}
        className={VIEW_BUTTON_CLASS}
      />
    );
  }
  return <PolicyContentButton content={version.content ?? ""} />;
}

/** A policy version with only inline text content — the same View button, a plain-text Modal. */
function PolicyContentButton({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button className={VIEW_BUTTON_CLASS} onClick={() => setOpen(true)}>
        <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
        View
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Policy Content" wide>
        <RichText value={content} className="text-sm text-slate-700" />
      </Modal>
    </>
  );
}

/**
 * One policy card — the platform's established compact card shape (Card, Badge, tight padding;
 * same grid ResourcesPage.tsx/AssessmentsPage.tsx use). No thumbnail box: unlike a resource file
 * or a course, a policy has no per-item image, so a decorative placeholder box would only add
 * empty height, not information — this keeps every card's height driven by its actual content.
 */
function PolicyCard({ item }: { item: PolicyResponse }) {
  return (
    <Card flush className="card-slide-scope flex flex-col">
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <h3 className="min-w-0 text-sm font-semibold leading-snug text-indigo-950">
            {item.title}
          </h3>
        </div>
        {item.description && (
          <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">
            {richTextToPlain(item.description)}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge tone="info">{item.active_version.version_label}</Badge>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {new Date(item.active_version.effective_date).toLocaleDateString()}
          </span>
        </div>

        <div className="mt-3 flex-1" />
        <ViewButton version={item.active_version} />
      </div>
    </Card>
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => (
              <PolicyCard key={item.id} item={item} />
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
