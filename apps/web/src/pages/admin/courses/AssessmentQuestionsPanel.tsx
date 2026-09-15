import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, HelpCircle, Pencil, Plus } from "lucide-react";
import type { AssessmentQuestionResponse } from "@internal-training/shared";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listAssessmentQuestions } from "../../../services/api/adminAssessments";
import { AssessmentQuestionFormModal } from "./AssessmentQuestionFormModal";
import { AssessmentQuestionOptionsPanel } from "./AssessmentQuestionOptionsPanel";

const OPTIONLESS_TYPES = new Set(["SHORT_ANSWER", "PRACTICAL_MANUAL"]);

/** Questions within one assessment — mirrors LessonsPanel one level down; options are a further level down (AssessmentQuestionOptionsPanel). */
export function AssessmentQuestionsPanel({
  courseId,
  assessmentId,
}: {
  courseId: string;
  assessmentId: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formState, setFormState] = useState<{
    open: boolean;
    question?: AssessmentQuestionResponse;
  }>({ open: false });

  const query = useQuery({
    queryKey: ["assessment-questions", assessmentId],
    queryFn: () => listAssessmentQuestions(courseId, assessmentId),
  });

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Questions</h4>
        <Button
          type="button"
          variant="secondary"
          className="gap-1 px-3 py-1.5 text-xs"
          onClick={() => setFormState({ open: true })}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New Question
        </Button>
      </div>

      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle="No questions yet"
        emptyDescription="Add the first question to this assessment."
      >
        {(questions) => (
          <ul className="space-y-2">
            {questions.map((question) => {
              const isOpen = expanded === question.id;
              const showOptions = !OPTIONLESS_TYPES.has(question.question_type);
              return (
                <li
                  key={question.id}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                      onClick={() => showOptions && setExpanded(isOpen ? null : question.id)}
                      disabled={!showOptions}
                    >
                      {showOptions &&
                        (isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                        ))}
                      <HelpCircle className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="truncate text-sm text-slate-800">
                        {question.question_text}
                      </span>
                      <Badge tone="info">{question.question_type}</Badge>
                      <Badge tone="neutral">{question.marks} pts</Badge>
                    </button>
                    <button
                      type="button"
                      className="shrink-0 cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      onClick={() => setFormState({ open: true, question })}
                      aria-label="Edit question"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  {isOpen && showOptions && (
                    <AssessmentQuestionOptionsPanel
                      courseId={courseId}
                      assessmentId={assessmentId}
                      questionId={question.id}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </RemoteDataView>

      <AssessmentQuestionFormModal
        open={formState.open}
        onClose={() => setFormState({ open: false })}
        courseId={courseId}
        assessmentId={assessmentId}
        question={formState.question}
        nextSortOrder={(query.data?.length ?? 0) + 1}
      />
    </div>
  );
}
