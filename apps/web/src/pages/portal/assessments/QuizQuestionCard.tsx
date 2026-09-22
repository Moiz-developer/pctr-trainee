import type {
  AssessmentAnswer,
  AssessmentAttemptQuestion,
  SubmitAssessmentAttemptAnswer,
} from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";

/**
 * The review-mode verdict line (course-ui-reference.jpeg's bold "Correct Answer: …" footer
 * line): the correct answer text itself is never sent to the client (SYSTEM_PLAN.md §19), so
 * this shows the same `is_correct`/marks data the card already displayed — previously as a small
 * pill next to the selected option — as one bold colored line instead, matching that reference's
 * weight/placement without exposing anything new.
 */
function VerdictLine({ isCorrect }: { isCorrect: boolean | null }) {
  if (isCorrect === true) {
    return <p className="text-sm font-semibold text-emerald-600">Correct answer</p>;
  }
  if (isCorrect === false) {
    return <p className="text-sm font-semibold text-orange-600">Incorrect answer</p>;
  }
  return <p className="text-sm font-semibold text-slate-500">Pending grading</p>;
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
  const answered =
    props.mode === "review" &&
    !!props.recorded &&
    (props.recorded.selected_option_id !== null || props.recorded.answer_text !== null);

  return (
    <Card className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xl font-bold text-indigo-950">Question {index + 1}:</h3>
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
                <span className="min-w-0">{option.option_text}</span>
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
          </div>
        ) : null}
      </div>

      {props.mode === "review" && (
        <div className="mt-4 space-y-1">
          <p className="text-xs text-slate-500">
            {answered
              ? "You have already answered this question."
              : "You did not answer this question."}
          </p>
          {answered && <VerdictLine isCorrect={props.recorded?.is_correct ?? null} />}
          <p className="text-xs font-medium text-indigo-900">
            {props.recorded?.marks_awarded != null
              ? `${props.recorded.marks_awarded} / ${question.marks} marks`
              : `${question.marks} marks available`}
          </p>
        </div>
      )}
    </Card>
  );
}
