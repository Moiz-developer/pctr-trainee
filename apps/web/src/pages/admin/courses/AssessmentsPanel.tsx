import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ClipboardList, Pencil, Plus, Users } from "lucide-react";
import type { AssessmentResponse } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { Can } from "../../../authorization/Can";
import { listAssessments, updateAssessment } from "../../../services/api/adminAssessments";
import { AssessmentFormModal } from "./AssessmentFormModal";
import { AssessmentQuestionsPanel } from "./AssessmentQuestionsPanel";
import { AssessmentAttemptsModal } from "./AssessmentAttemptsModal";

const STATUS_TONE: Record<AssessmentResponse["status"], BadgeTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

/**
 * Assessments for one course (SYSTEM_PLAN.md §14.4, permission
 * `assessment.manage`) — mirrors CourseModulesPanel's expand-to-manage-children
 * shape: expand an assessment to manage its questions (and, one level
 * deeper, each question's options). "View Attempts" opens the grading
 * queue (permission `assessment.grade`) as a separate modal rather than a
 * third expand level, since attempts belong to trainees, not to the
 * assessment's own authored structure.
 */
export function AssessmentsPanel({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formState, setFormState] = useState<{ open: boolean; assessment?: AssessmentResponse }>({
    open: false,
  });
  const [attemptsTarget, setAttemptsTarget] = useState<AssessmentResponse | null>(null);

  const query = useQuery({
    queryKey: ["assessments", courseId],
    queryFn: () => listAssessments(courseId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["assessments", courseId] });

  const setStatus = useMutation({
    mutationFn: ({
      assessment,
      status,
    }: {
      assessment: AssessmentResponse;
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    }) => updateAssessment(courseId, assessment.id, { status }),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Assessments</h3>
          <p className="mt-1 text-xs text-slate-500">
            Expand an assessment to manage its questions.
          </p>
        </div>
        <Can permission="assessment.manage">
          <Button type="button" className="gap-2" onClick={() => setFormState({ open: true })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Assessment
          </Button>
        </Can>
      </div>

      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle="No assessments yet"
        emptyDescription="Create the first assessment for this course."
      >
        {(assessments) => (
          <ul className="space-y-2">
            {assessments.map((assessment) => {
              const isOpen = expanded === assessment.id;
              return (
                <li
                  key={assessment.id}
                  className="overflow-hidden rounded-lg border border-slate-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                      onClick={() => setExpanded(isOpen ? null : assessment.id)}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <ClipboardList
                        className="h-4 w-4 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-medium text-slate-900">
                        {assessment.title}
                      </span>
                      <Badge tone={STATUS_TONE[assessment.status]}>{assessment.status}</Badge>
                      <Badge tone="neutral">{assessment.type}</Badge>
                      <span className="text-xs text-slate-400">
                        {assessment.passing_marks}/{assessment.total_marks} to pass
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Can permission="assessment.grade">
                        <Button
                          type="button"
                          variant="ghost"
                          className="gap-1 px-2 py-1 text-xs"
                          onClick={() => setAttemptsTarget(assessment)}
                        >
                          <Users className="h-3.5 w-3.5" aria-hidden="true" />
                          Attempts
                        </Button>
                      </Can>
                      <Can permission="assessment.manage">
                        <button
                          type="button"
                          className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          onClick={() => setFormState({ open: true, assessment })}
                          aria-label="Edit assessment"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {assessment.status === "DRAFT" && (
                          <Button
                            type="button"
                            className="px-2 py-1 text-xs"
                            disabled={setStatus.isPending}
                            onClick={() => setStatus.mutate({ assessment, status: "PUBLISHED" })}
                          >
                            Publish
                          </Button>
                        )}
                        {assessment.status === "PUBLISHED" && (
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            disabled={setStatus.isPending}
                            onClick={() => setStatus.mutate({ assessment, status: "DRAFT" })}
                          >
                            Revert to Draft
                          </Button>
                        )}
                        {assessment.status !== "ARCHIVED" && (
                          <Button
                            type="button"
                            variant="destructive"
                            className="px-2 py-1 text-xs"
                            disabled={setStatus.isPending}
                            onClick={() => setStatus.mutate({ assessment, status: "ARCHIVED" })}
                          >
                            Archive
                          </Button>
                        )}
                      </Can>
                    </div>
                  </div>
                  {isOpen && (
                    <AssessmentQuestionsPanel courseId={courseId} assessmentId={assessment.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </RemoteDataView>

      <AssessmentFormModal
        open={formState.open}
        onClose={() => setFormState({ open: false })}
        courseId={courseId}
        assessment={formState.assessment}
      />
      {attemptsTarget && (
        <AssessmentAttemptsModal
          open={!!attemptsTarget}
          onClose={() => setAttemptsTarget(null)}
          courseId={courseId}
          assessment={attemptsTarget}
        />
      )}
    </Card>
  );
}
