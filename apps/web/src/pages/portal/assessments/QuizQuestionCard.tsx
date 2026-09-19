import type {
  AssessmentAnswer,
  AssessmentAttemptQuestion,
  SubmitAssessmentAttemptAnswer,
} from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";

/** The reference's per-option verdict pill, driven by the answer's recorded `is_correct` (null = not graded yet). */
function VerdictPill({ isCorrect }: { isCorrect: boolean | null }) {
  if (isCorrect === true) {
    return (
      <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        Correct
      </span>
    );
  }
  if (isCorrect === false) {
    return (
      <span className="ml-1.5 rounded-full bg-orange-200 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
        Incorrect
      </span>
    );
  }
  return (
    <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
      Pending grading
    </span>
  );
}

type QuizQuestionCardProps = { index: number; question: AssessmentAttemptQuestion } & (
  | {
      mode: "take";
      answer: SubmitAssessmentAttemptAnswer | undefined;
      onChoose: (questionId: string, optionId: string) => void;
      onText: (questionId: string, text: string) => void;
    }
  | { mode: "review"; recorded: AssessmentAnswer | undefined }
);

/**
 * One question as a card ("Question 3:" heading, question text, options), used
 * for both taking an attempt and reviewing a submitted one so the two views look
 * the same. Take mode is the exact existing behaviour — a native single-select
 * radio group per question (this schema records one `selected_option_id` per
 * answer) or a textarea for option-less questions, reporting through the same
 * callbacks. Review mode is read-only and shows only what the API already
 * returns for the caller's own attempt: the option they chose, whether it was
 * correct, and the marks awarded. The correct answer itself is never sent to the
 * client (SYSTEM_PLAN.md §19), so it is not shown.
 */
export function QuizQuestionCard(props: QuizQuestionCardProps) {
  const { index, question } = props;
  const hasOptions = question.options.length > 0;

  return (
    <Card className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xl font-medium text-indigo-950">Question {index + 1}:</h3>
        {props.mode === "take" && (
          <span className="shrink-0 text-xs text-slate-400">{question.marks} pts</span>
        )}
      </div>
      <p className="mt-3 text-sm font-semibold leading-snug text-slate-900">
        {question.question_text}
      </p>

      <div className="mt-3 flex-1 space-y-1">
        {hasOptions ? (
          question.options.map((option) => {
            if (props.mode === "take") {
              const checked = props.answer?.selected_option_id === option.id;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    checked
                      ? "bg-indigo-50 font-medium text-indigo-950"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    className="peer sr-only"
                    checked={checked}
                    onChange={() => props.onChoose(question.id, option.id)}
                  />
                  <span
                    className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300 peer-checked:border-indigo-900 peer-checked:bg-indigo-900 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">{option.option_text}</span>
                </label>
              );
            }
            const selected = props.recorded?.selected_option_id === option.id;
            return (
              <div
                key={option.id}
                className={`flex items-start gap-2.5 px-2 py-1.5 text-sm ${
                  selected ? "font-medium text-slate-800" : "text-slate-400"
                }`}
              >
                <span
                  className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                    selected ? "border-indigo-900 bg-indigo-900" : "border-slate-200"
                  }`}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  {option.option_text}
                  {selected && <VerdictPill isCorrect={props.recorded?.is_correct ?? null} />}
                </span>
              </div>
            );
          })
        ) : props.mode === "take" ? (
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            rows={4}
            value={props.answer?.answer_text ?? ""}
            onChange={(event) => props.onText(question.id, event.target.value)}
            placeholder="Your answer…"
            aria-label={`Answer to question ${index + 1}`}
          />
        ) : props.recorded?.answer_text ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <p className="whitespace-pre-wrap">{props.recorded.answer_text}</p>
            <div className="mt-1.5">
              <VerdictPill isCorrect={props.recorded.is_correct} />
            </div>
          </div>
        ) : null}
      </div>

      {props.mode === "review" && (
        <div className="mt-4 space-y-0.5 text-xs">
          <p className="text-slate-500">
            {props.recorded &&
            (props.recorded.selected_option_id !== null || props.recorded.answer_text !== null)
              ? "You have already answered this question."
              : "You did not answer this question."}
          </p>
          <p className="font-medium text-indigo-900">
            {props.recorded?.marks_awarded != null
              ? `${props.recorded.marks_awarded} / ${question.marks} marks`
              : `${question.marks} marks available`}
          </p>
        </div>
      )}
    </Card>
  );
}
