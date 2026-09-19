import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Info,
  KeyRound,
  Layers,
  Pencil,
  Tag,
  type LucideIcon,
} from "lucide-react";
import type { CourseStatus } from "@internal-training/shared";
import { Card, CardHeader } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { Can } from "../../../authorization/Can";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { archiveCourse, getCourse, updateCourse } from "../../../services/api/courses";
import { CourseFormModal } from "./CourseFormModal";
import { CourseDepartmentsPanel } from "./CourseDepartmentsPanel";
import { CourseModulesPanel } from "./CourseModulesPanel";
import { CourseAccessPanel } from "./CourseAccessPanel";
import { AssessmentsPanel } from "./AssessmentsPanel";
import { AdminCourseTabs, type AdminCourseTabDef } from "./AdminCourseTabs";

const STATUS_TONE: Record<CourseStatus, BadgeTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

type Tab = "details" | "departments" | "modules" | "assessments" | "access";
const TABS: AdminCourseTabDef<Tab>[] = [
  { id: "details", label: "Details", icon: Info },
  { id: "departments", label: "Departments", icon: Building2 },
  { id: "modules", label: "Modules & Lessons", icon: Layers },
  { id: "assessments", label: "Assessments", icon: ClipboardList },
  { id: "access", label: "Access", icon: KeyRound },
];

/** One labelled fact in the Details tab (icon tile + small caps label + value). */
function InfoTile({
  icon: Icon,
  label,
  children,
  caption,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  caption?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-900">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold text-indigo-950">{children}</p>
        {caption && <p className="text-xs text-slate-500">{caption}</p>}
      </div>
    </div>
  );
}

export function AdminCourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
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
    onSuccess: async (_data, status) => {
      await invalidate();
      toast.success(status === "PUBLISHED" ? "Course published." : "Course reverted to draft.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Something went wrong.");
    },
  });
  const archive = useMutation({
    mutationFn: () => archiveCourse(id!),
    onSuccess: async () => {
      await invalidate();
      setArchiveConfirmOpen(false);
      toast.success("Course archived.");
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "Failed to archive the course.",
      );
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="text-xl font-semibold text-slate-900">{course.title}</h2>
                  <Badge tone={STATUS_TONE[course.status]} solid>
                    {course.status}
                  </Badge>
                </div>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">/{course.slug}</p>
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

            <AdminCourseTabs tabs={TABS} active={tab} onChange={setTab} />

            <div
              role="tabpanel"
              id={`course-admin-panel-${tab}`}
              aria-labelledby={`course-admin-tab-${tab}`}
            >
              {tab === "details" && (
                <Card flush>
                  <CardHeader title="Course Information" />
                  <div className="space-y-6 p-6">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <InfoTile icon={Tag} label="Category">
                        {course.category?.name ?? "—"}
                      </InfoTile>
                      <InfoTile icon={Clock} label="Duration">
                        {course.duration_minutes ? `${course.duration_minutes} min` : "—"}
                      </InfoTile>
                      <InfoTile
                        icon={CalendarClock}
                        label="Last updated"
                        caption={`Created ${new Date(course.created_at).toLocaleDateString()}${
                          course.archived_at
                            ? ` · Archived ${new Date(course.archived_at).toLocaleDateString()}`
                            : ""
                        }`}
                      >
                        {new Date(course.updated_at).toLocaleDateString()}
                      </InfoTile>
                    </div>

                    <section>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Description
                      </h4>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {course.description ?? "No description provided."}
                      </p>
                    </section>

                    <section>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Completion criteria
                      </h4>
                      {course.completion_require_all_lessons ||
                      course.completion_require_practical ||
                      course.completion_require_assessment_pass ? (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {course.completion_require_all_lessons && (
                            <li className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              All lessons
                            </li>
                          )}
                          {course.completion_require_practical && (
                            <li className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Practical lessons
                            </li>
                          )}
                          {course.completion_require_assessment_pass && (
                            <li className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Assessment pass
                              {course.completion_min_assessment_score_pct !== null
                                ? ` (≥${course.completion_min_assessment_score_pct}%)`
                                : ""}
                            </li>
                          )}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          No completion criteria are required.
                        </p>
                      )}
                    </section>
                  </div>
                </Card>
              )}
              {tab === "departments" && <CourseDepartmentsPanel courseId={course.id} />}
              {tab === "modules" && <CourseModulesPanel courseId={course.id} />}
              {tab === "assessments" && <AssessmentsPanel courseId={course.id} />}
              {tab === "access" && <CourseAccessPanel courseId={course.id} />}
            </div>

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
