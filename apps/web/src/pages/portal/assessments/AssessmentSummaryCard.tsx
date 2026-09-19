import type { ReactNode } from "react";
import type { MyAssessmentSummary } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { formatPercentage } from "./assessmentLabels";

// Slice colours, cycled per assessment (also the legend swatches in the table).
const PALETTE = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];
const TRACK = "#e2e8f0";
const PROGRESS = "#312c85";

interface DonutSegment {
  value: number;
  color: string;
}

/** A dependency-free SVG donut: each segment is an arc of the ring, `children` sit in the middle. */
function DonutChart({
  segments,
  size = 168,
  thickness = 24,
  children,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  children: ReactNode;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={TRACK}
            strokeWidth={thickness}
          />
          {total > 0 &&
            segments
              .filter((s) => s.value > 0)
              .map((segment, index) => {
                const length = (segment.value / total) * circumference;
                const arc = (
                  <circle
                    key={index}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={thickness}
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += length;
                return arc;
              })}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

/**
 * The reference's summary card: overall progress donut, current-score donut and
 * a per-assessment score table. Everything is computed from the assessments the
 * list API already returned — completed count from the derived status, scores
 * from each assessment's best completed attempt — nothing is stored or invented.
 */
export function AssessmentSummaryCard({ assessments }: { assessments: MyAssessmentSummary[] }) {
  const total = assessments.length;
  const completed = assessments.filter((a) => a.my_status === "COMPLETED").length;
  const completedPct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const earned = assessments.reduce((sum, a) => sum + (a.my_best_score ?? 0), 0);
  const totalMarks = assessments.reduce((sum, a) => sum + a.total_marks, 0);

  return (
    <Card>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="flex flex-col items-center gap-2 text-center lg:w-56">
          <h3 className="text-sm font-semibold text-indigo-950">Overall Assessment Progress</h3>
          <p className="text-xs font-medium text-slate-600">
            {completed}/{total} Assessments Completed
          </p>
          <DonutChart
            segments={[
              { value: completed, color: PROGRESS },
              { value: total - completed, color: TRACK },
            ]}
          >
            <span className="text-xs text-slate-500">Completed</span>
            <span className="text-2xl font-semibold text-indigo-950">{completedPct}%</span>
          </DonutChart>
        </div>

        <div className="flex flex-col items-center gap-2 text-center lg:w-56">
          <h3 className="text-sm font-semibold text-indigo-950">Current Score</h3>
          <p className="text-2xl font-semibold text-indigo-950">{earned}</p>
          <DonutChart
            segments={[
              ...assessments.map((a, index) => ({
                value: a.my_best_score ?? 0,
                color: PALETTE[index % PALETTE.length]!,
              })),
              { value: Math.max(0, totalMarks - earned), color: TRACK },
            ]}
          >
            <span className="text-xs text-slate-500">Total Value</span>
            <span className="text-2xl font-semibold text-indigo-950">{totalMarks}</span>
          </DonutChart>
        </div>

        <div className="min-w-0 flex-1">
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">Assessment</th>
                  <th className="whitespace-nowrap py-2 pr-4 font-medium">Value</th>
                  <th className="py-2 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((assessment, index) => (
                  <tr key={assessment.id} className="border-b border-slate-50">
                    <td className="py-1.5 pr-4 text-slate-700">
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                        style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
                        aria-hidden="true"
                      />
                      {assessment.title}
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-4 text-slate-600">
                      {assessment.my_best_score ?? "—"}/{assessment.total_marks}
                    </td>
                    <td className="whitespace-nowrap py-1.5 text-slate-600">
                      {assessment.my_best_percentage !== null
                        ? formatPercentage(assessment.my_best_percentage)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  );
}
