import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Pencil, Plus } from "lucide-react";
import type { AssessmentQuestionOptionResponse } from "@internal-training/shared";
import { Button } from "../../../components/ui/Button";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listAssessmentQuestionOptions } from "../../../services/api/adminAssessments";
import { AssessmentQuestionOptionFormModal } from "./AssessmentQuestionOptionFormModal";

/** Options for one SINGLE_CHOICE/MULTIPLE_CHOICE/TRUE_FALSE question — not shown for SHORT_ANSWER/PRACTICAL_MANUAL (§14.4). */
export function AssessmentQuestionOptionsPanel({
  courseId,
  assessmentId,
  questionId,
}: {
  courseId: string;
  assessmentId: string;
  questionId: string;
}) {
  const [formState, setFormState] = useState<{
    open: boolean;
    option?: AssessmentQuestionOptionResponse;
  }>({ open: false });

  const query = useQuery({
    queryKey: ["assessment-question-options", questionId],
    queryFn: () => listAssessmentQuestionOptions(courseId, assessmentId, questionId),
  });

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 pl-10">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Options</p>
        <Button
          type="button"
          variant="ghost"
          className="gap-1 px-2 py-1 text-xs"
          onClick={() => setFormState({ open: true })}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add Option
        </Button>
      </div>

      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle="No options yet"
      >
        {(options) => (
          <ul className="space-y-1">
            {options.map((option) => (
              <li key={option.id} className="flex items-center justify-between gap-2 py-0.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  {option.is_correct ? (
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />
                  )}
                  <span className="truncate text-xs text-slate-700">{option.option_text}</span>
                </div>
                <button
                  type="button"
                  className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => setFormState({ open: true, option })}
                  aria-label="Edit option"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </RemoteDataView>

      <AssessmentQuestionOptionFormModal
        open={formState.open}
        onClose={() => setFormState({ open: false })}
        courseId={courseId}
        assessmentId={assessmentId}
        questionId={questionId}
        option={formState.option}
        nextSortOrder={(query.data?.length ?? 0) + 1}
      />
    </div>
  );
}
