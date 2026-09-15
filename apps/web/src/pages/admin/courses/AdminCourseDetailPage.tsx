import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import type { CourseStatus } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { Can } from "../../../authorization/Can";
import { archiveCourse, getCourse, updateCourse } from "../../../services/api/courses";
import { CourseFormModal } from "./CourseFormModal";
import { CourseDepartmentsPanel } from "./CourseDepartmentsPanel";
import { CourseModulesPanel } from "./CourseModulesPanel";
import { CourseAccessPanel } from "./CourseAccessPanel";
import { AssessmentsPanel } from "./AssessmentsPanel";

const STATUS_TONE: Record<CourseStatus, BadgeTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

type Tab = "details" | "departments" | "modules" | "assessments" | "access";
const TABS: { id: Tab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "departments", label: "Departments" },
  { id: "modules", label: "Modules & Lessons" },
  { id: "assessments", label: "Assessments" },
  { id: "access", label: "Access" },
];

export function AdminCourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("details");
  const [editOpen, setEditOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  const query = useQuery({
    queryKey: ["admin-course", id],
    queryFn: () => getCourse(id!),
    enabled: !!id,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-course", id] });
    await queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
  };

  const setStatus = useMutation({
    mutationFn: (status: "DRAFT" | "PUBLISHED") => updateCourse(id!, { status }),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: () => archiveCourse(id!),
    onSuccess: async () => {
      await invalidate();
      setArchiveConfirmOpen(false);
    },
  });

  if (!id) return null;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => void navigate("/admin/courses")}
        className="flex cursor-pointer items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Courses
      </button>

      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
      >
        {(course) => (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">{course.title}</h2>
                  <Badge tone={STATUS_TONE[course.status]}>{course.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">/{course.slug}</p>
              </div>
              <Can permission="course.create">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="gap-2" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </Button>
                  {course.status === "DRAFT" && (
                    <Button
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate("PUBLISHED")}
                    >
                      Publish
                    </Button>
                  )}
                  {course.status === "PUBLISHED" && (
                    <Button
                      variant="secondary"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate("DRAFT")}
                    >
                      Revert to Draft
                    </Button>
                  )}
                  {course.status !== "ARCHIVED" && (
                    <Can permission="course.delete">
                      <Button variant="destructive" onClick={() => setArchiveConfirmOpen(true)}>
                        Archive
                      </Button>
                    </Can>
                  )}
                </div>
              </Can>
            </div>

            <div className="border-b border-slate-200">
              <nav className="-mb-px flex gap-6">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`cursor-pointer border-b-2 px-1 py-3 text-sm font-medium ${
                      tab === t.id
                        ? "border-indigo-900 text-indigo-900"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>

            {tab === "details" && (
              <Card>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">{course.category?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Duration
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {course.duration_minutes ? `${course.duration_minutes} min` : "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Description
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                      {course.description ?? "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Completion criteria
                    </dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      {course.completion_require_all_lessons && <Badge>All lessons</Badge>}
                      {course.completion_require_practical && <Badge>Practical lessons</Badge>}
                      {course.completion_require_assessment_pass && (
                        <Badge>
                          Assessment pass
                          {course.completion_min_assessment_score_pct !== null
                            ? ` (≥${course.completion_min_assessment_score_pct}%)`
                            : ""}
                        </Badge>
                      )}
                    </dd>
                  </div>
                </dl>
              </Card>
            )}
            {tab === "departments" && <CourseDepartmentsPanel courseId={course.id} />}
            {tab === "modules" && <CourseModulesPanel courseId={course.id} />}
            {tab === "assessments" && <AssessmentsPanel courseId={course.id} />}
            {tab === "access" && <CourseAccessPanel courseId={course.id} />}

            <CourseFormModal
              open={editOpen}
              onClose={() => setEditOpen(false)}
              course={course}
              onSuccess={() => void invalidate()}
            />
            <ConfirmDialog
              open={archiveConfirmOpen}
              title="Archive course"
              description={`"${course.title}" will be archived and hidden from trainees. This preserves the record but cannot be undone through the admin UI.`}
              confirmLabel="Archive"
              isPending={archive.isPending}
              onCancel={() => setArchiveConfirmOpen(false)}
              onConfirm={() => archive.mutate()}
            />
          </>
        )}
      </RemoteDataView>
    </div>
  );
}
