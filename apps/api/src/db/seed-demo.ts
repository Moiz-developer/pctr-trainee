import "dotenv/config";
import { prismaPrivileged as prisma } from "../lib/prisma-privileged.js";
import { getSupabaseAdmin } from "../lib/supabase-admin.js";
import { env } from "../config/env.js";
import type { LessonContentType, LessonClassification } from "../generated/prisma/client.js";

// Development/demo data seed (Phase 2C follow-up — NOT part of SYSTEM_PLAN.md's
// phased feature plan). Populates the already-implemented schema with
// realistic, clearly-labelled demo records (all emails end in
// "@example.com", the IANA-reserved demo domain, and every employee_id is
// prefixed "DEMO-") so the Admin Portal and User/Trainer Portal can be
// exercised manually end-to-end. Deliberately refuses to run against
// NODE_ENV=production — this is throwaway data, not a production fixture.
//
// Idempotent: every entity is looked up by its natural unique key
// (email/slug/title/compound unique constraint) before being created, so
// running this script repeatedly updates the same rows instead of
// duplicating them. No id is ever hardcoded — every relationship uses the
// id the database generated for its parent row.
//
// To remove all demo data later: `DELETE FROM profiles WHERE employee_id
// LIKE 'DEMO-%'` cascades (ON DELETE CASCADE) through user_departments,
// course_access, lesson_progress, and courses.created_by/*_by SET NULL; then
// delete the demo courses (`DELETE FROM courses WHERE slug LIKE 'demo-%' OR
// title similar`) which cascades through course_departments, course_modules,
// course_lessons, lesson_progress; then the four demo departments. No
// application code or migration needs to change either way.

if (env.NODE_ENV === "production") {
  console.error(
    "[seed-demo] Refusing to run with NODE_ENV=production. This is dev/demo data only.",
  );
  process.exit(1);
}

const supabaseAdmin = getSupabaseAdmin();

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

const DEPARTMENTS = [
  { name: "Sales", slug: "sales", description: "Demo department (db:seed:demo)." },
  { name: "Recruitment", slug: "recruitment", description: "Demo department (db:seed:demo)." },
  { name: "Training", slug: "training", description: "Demo department (db:seed:demo)." },
  { name: "Operations", slug: "operations", description: "Demo department (db:seed:demo)." },
] as const;

async function ensureDepartment(spec: (typeof DEPARTMENTS)[number]) {
  return prisma.department.upsert({
    where: { slug: spec.slug },
    update: { name: spec.name, description: spec.description },
    create: spec,
  });
}

// ---------------------------------------------------------------------------
// Course Categories (Admin Navigation + Dynamic Course Categories unit).
// Same four names the demo courses already used as free text before that
// unit's migration replaced courses.category with a real FK — the migration
// itself backfilled these exact rows from the pre-existing data, so this
// upsert simply matches them by slug on every subsequent seed run.
// ---------------------------------------------------------------------------

const COURSE_CATEGORIES = [
  { name: "Sales", slug: "sales", description: "Demo course category (db:seed:demo)." },
  {
    name: "Recruitment",
    slug: "recruitment",
    description: "Demo course category (db:seed:demo).",
  },
  { name: "Training", slug: "training", description: "Demo course category (db:seed:demo)." },
  {
    name: "Operations",
    slug: "operations",
    description: "Demo course category (db:seed:demo).",
  },
] as const;

async function ensureCourseCategory(spec: (typeof COURSE_CATEGORIES)[number]) {
  return prisma.courseCategory.upsert({
    where: { slug: spec.slug },
    update: { name: spec.name, description: spec.description },
    create: spec,
  });
}

// ---------------------------------------------------------------------------
// Users (2 admins + 4 trainers, one per department)
// ---------------------------------------------------------------------------

type DemoUserSpec = {
  employeeId: string;
  fullName: string;
  email: string;
  roleCode: "ADMIN" | "TRAINER_USER";
  password: string;
  departmentSlug: string | null;
};

const DEMO_USERS: DemoUserSpec[] = [
  {
    employeeId: "DEMO-ADMIN-001",
    fullName: "Demo Admin",
    email: "admin.demo@example.com",
    roleCode: "ADMIN",
    password: "AdminDemo#2026!Kx7Q",
    departmentSlug: null,
  },
  {
    employeeId: "DEMO-ADMIN-002",
    fullName: "Secondary Demo Admin",
    email: "admin2.demo@example.com",
    roleCode: "ADMIN",
    password: "AdminDemo#2026!Zt4M",
    departmentSlug: null,
  },
  {
    employeeId: "DEMO-SALES-001",
    fullName: "Sales Demo User",
    email: "sales.demo@example.com",
    roleCode: "TRAINER_USER",
    password: "SalesDemo#2026!Rp2W",
    departmentSlug: "sales",
  },
  {
    employeeId: "DEMO-RECRUIT-001",
    fullName: "Recruitment Demo User",
    email: "recruitment.demo@example.com",
    roleCode: "TRAINER_USER",
    password: "RecruitDemo#2026!Bn8L",
    departmentSlug: "recruitment",
  },
  {
    employeeId: "DEMO-TRAIN-001",
    fullName: "Training Demo User",
    email: "training.demo@example.com",
    roleCode: "TRAINER_USER",
    password: "TrainDemo#2026!Vq5H",
    departmentSlug: "training",
  },
  {
    employeeId: "DEMO-OPS-001",
    fullName: "Operations Demo User",
    email: "operations.demo@example.com",
    roleCode: "TRAINER_USER",
    password: "OpsDemo#2026!Fy3T",
    departmentSlug: "operations",
  },
];

/**
 * Finds an existing Supabase Auth user by email (paginated scan — the admin
 * SDK has no direct "get by email" lookup). Only ever needed as a recovery
 * path if a previous seed run created the Auth user but crashed before the
 * profile row was written.
 */
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureDemoUser(
  spec: DemoUserSpec,
  roleIdByCode: Map<string, string>,
  departmentIdBySlug: Map<string, string>,
  assignedByProfileId: string | null,
): Promise<{ id: string; created: boolean }> {
  const roleId = roleIdByCode.get(spec.roleCode);
  if (!roleId) throw new Error(`Role "${spec.roleCode}" not found — run db:seed first.`);

  const existingProfile = await prisma.profile.findUnique({ where: { email: spec.email } });

  let authUserId: string;
  let created = false;

  if (existingProfile) {
    authUserId = existingProfile.id;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
      user_metadata: { full_name: spec.fullName, demo_seed: true },
    });
    if (error || !data.user) {
      if (error?.code === "email_exists") {
        const found = await findAuthUserIdByEmail(spec.email);
        if (!found) {
          throw new Error(`Auth user for "${spec.email}" reported as existing but not found.`);
        }
        authUserId = found;
      } else {
        throw new Error(
          `Failed to create Supabase Auth user for "${spec.email}": ${error?.message}`,
        );
      }
    } else {
      authUserId = data.user.id;
      created = true;
    }
  }

  await prisma.profile.upsert({
    where: { email: spec.email },
    update: {
      fullName: spec.fullName,
      employeeId: spec.employeeId,
      roleId,
      status: "ACTIVE",
    },
    create: {
      id: authUserId,
      employeeId: spec.employeeId,
      fullName: spec.fullName,
      email: spec.email,
      roleId,
      status: "ACTIVE",
    },
  });

  if (spec.departmentSlug) {
    const departmentId = departmentIdBySlug.get(spec.departmentSlug);
    if (!departmentId) throw new Error(`Department "${spec.departmentSlug}" not found.`);
    await prisma.userDepartment.upsert({
      where: { userId_departmentId: { userId: authUserId, departmentId } },
      update: {},
      create: {
        userId: authUserId,
        departmentId,
        isPrimary: true,
        assignedBy: assignedByProfileId,
      },
    });
  }

  return { id: authUserId, created };
}

// ---------------------------------------------------------------------------
// Courses, modules, lessons
// ---------------------------------------------------------------------------

type LessonSpec = {
  title: string;
  contentType: LessonContentType;
  classification: LessonClassification;
  isRequired: boolean;
  textContent?: string;
  externalUrl?: string;
};

type ModuleSpec = { title: string; description: string; lessons: LessonSpec[] };

type CourseSpec = {
  title: string;
  slug: string;
  description: string;
  category: string;
  durationMinutes: number;
  status: "DRAFT" | "PUBLISHED";
  departmentSlug: string;
  modules: ModuleSpec[];
};

// EXTERNAL_LINK lessons point at example.com (IANA-reserved demo domain) —
// never a real resource, and doubles as a visible "this is demo data" signal.
// No VIDEO/PDF/DOCUMENT/PRESENTATION lessons: those require a real
// media_asset_id, attached only via the dedicated upload/confirm/attach
// media flow (Unit 2.8) — fabricating one here would mean either uploading a
// throwaway binary to the real Supabase Storage bucket for no functional
// reason, or leaving media_asset_id null on a lesson whose content_type
// claims otherwise. TEXT/EXTERNAL_LINK are the two content types usable
// without a real uploaded file, exactly as this task's own instructions
// anticipate ("Otherwise use TEXT or EXTERNAL_LINK lessons for the demo
// dataset").
function introModule(topic: string, slug: string): ModuleSpec {
  return {
    title: `Introduction to ${topic}`,
    description: `Foundational concepts every new team member needs before starting ${topic.toLowerCase()}.`,
    lessons: [
      {
        title: "Overview",
        contentType: "TEXT",
        classification: "THEORETICAL",
        isRequired: true,
        textContent: `This lesson introduces the core concepts of ${topic}. (Demo lesson content — db:seed:demo.)`,
      },
      {
        title: "Further Reading",
        contentType: "EXTERNAL_LINK",
        classification: "THEORETICAL",
        isRequired: false,
        externalUrl: `https://example.com/demo-resources/${slug}/further-reading`,
      },
    ],
  };
}

function practiceModule(topic: string, slug: string): ModuleSpec {
  return {
    title: `${topic} in Practice`,
    description: `Applied scenarios and exercises for ${topic.toLowerCase()}.`,
    lessons: [
      {
        title: "Practical Scenario",
        contentType: "TEXT",
        classification: "PRACTICAL",
        isRequired: true,
        textContent: `Walk through a realistic ${topic} scenario and how to handle it. (Demo lesson content — db:seed:demo.)`,
      },
      {
        title: "Practice Exercise",
        contentType: "EXTERNAL_LINK",
        classification: "PRACTICAL",
        isRequired: true,
        externalUrl: `https://example.com/demo-resources/${slug}/practice-exercise`,
      },
    ],
  };
}

const COURSES: CourseSpec[] = [
  {
    title: "Sales Fundamentals",
    slug: "sales-fundamentals",
    description: "Core selling principles for new Sales team members. (Demo course.)",
    category: "Sales",
    durationMinutes: 60,
    status: "PUBLISHED",
    departmentSlug: "sales",
    modules: [
      introModule("Sales", "sales-fundamentals"),
      practiceModule("Sales", "sales-fundamentals"),
    ],
  },
  {
    title: "Consultative Selling",
    slug: "consultative-selling",
    description: "Needs-based, consultative approaches to selling. (Demo course.)",
    category: "Sales",
    durationMinutes: 90,
    status: "PUBLISHED",
    departmentSlug: "sales",
    modules: [
      introModule("Consultative Selling", "consultative-selling"),
      practiceModule("Consultative Selling", "consultative-selling"),
    ],
  },
  {
    title: "Advanced Sales Negotiation (Draft)",
    slug: "advanced-sales-negotiation-draft",
    description:
      "Draft course kept unpublished on purpose, to verify draft courses never appear in the catalogue. (Demo course.)",
    category: "Sales",
    durationMinutes: 45,
    status: "DRAFT",
    departmentSlug: "sales",
    modules: [],
  },
  {
    title: "Recruitment Fundamentals",
    slug: "recruitment-fundamentals",
    description: "Core recruitment process and principles. (Demo course.)",
    category: "Recruitment",
    durationMinutes: 60,
    status: "PUBLISHED",
    departmentSlug: "recruitment",
    modules: [
      introModule("Recruitment", "recruitment-fundamentals"),
      practiceModule("Recruitment", "recruitment-fundamentals"),
    ],
  },
  {
    title: "Interview & Candidate Evaluation",
    slug: "interview-candidate-evaluation",
    description: "Structured interviewing and candidate evaluation techniques. (Demo course.)",
    category: "Recruitment",
    durationMinutes: 75,
    status: "PUBLISHED",
    departmentSlug: "recruitment",
    modules: [
      introModule("Candidate Evaluation", "interview-candidate-evaluation"),
      practiceModule("Candidate Evaluation", "interview-candidate-evaluation"),
    ],
  },
  {
    title: "Trainer Fundamentals",
    slug: "trainer-fundamentals",
    description: "Foundations of being an effective internal trainer. (Demo course.)",
    category: "Training",
    durationMinutes: 60,
    status: "PUBLISHED",
    departmentSlug: "training",
    modules: [
      introModule("Training", "trainer-fundamentals"),
      practiceModule("Training", "trainer-fundamentals"),
    ],
  },
  {
    title: "Effective Training Delivery",
    slug: "effective-training-delivery",
    description: "Delivery techniques for engaging, effective training sessions. (Demo course.)",
    category: "Training",
    durationMinutes: 90,
    status: "PUBLISHED",
    departmentSlug: "training",
    modules: [
      introModule("Training Delivery", "effective-training-delivery"),
      practiceModule("Training Delivery", "effective-training-delivery"),
    ],
  },
  {
    title: "Operations & Workplace Procedures",
    slug: "operations-workplace-procedures",
    description: "Standard operating procedures and workplace policies. (Demo course.)",
    category: "Operations",
    durationMinutes: 60,
    status: "PUBLISHED",
    departmentSlug: "operations",
    modules: [
      introModule("Operations", "operations-workplace-procedures"),
      practiceModule("Operations", "operations-workplace-procedures"),
    ],
  },
];

async function ensureCourse(
  spec: CourseSpec,
  createdBy: string,
  categoryIdByName: Map<string, string>,
) {
  const categoryId = categoryIdByName.get(spec.category);
  if (!categoryId) throw new Error(`Course category "${spec.category}" not found.`);

  const course = await prisma.course.upsert({
    where: { slug: spec.slug },
    update: {
      title: spec.title,
      description: spec.description,
      categoryId,
      durationMinutes: spec.durationMinutes,
      status: spec.status,
    },
    create: {
      title: spec.title,
      slug: spec.slug,
      description: spec.description,
      categoryId,
      durationMinutes: spec.durationMinutes,
      status: spec.status,
      createdBy,
    },
  });

  const lessonsBySlugAndTitle = new Map<string, { id: string }>();

  let sortOrder = 1;
  for (const moduleSpec of spec.modules) {
    const existingModule = await prisma.courseModule.findFirst({
      where: { courseId: course.id, title: moduleSpec.title },
    });
    const module = existingModule
      ? await prisma.courseModule.update({
          where: { id: existingModule.id },
          data: { description: moduleSpec.description, sortOrder },
        })
      : await prisma.courseModule.create({
          data: {
            courseId: course.id,
            title: moduleSpec.title,
            description: moduleSpec.description,
            sortOrder,
          },
        });
    sortOrder += 1;

    let lessonSortOrder = 1;
    for (const lessonSpec of moduleSpec.lessons) {
      const existingLesson = await prisma.courseLesson.findFirst({
        where: { moduleId: module.id, title: lessonSpec.title },
      });
      const lesson = existingLesson
        ? await prisma.courseLesson.update({
            where: { id: existingLesson.id },
            data: {
              contentType: lessonSpec.contentType,
              textContent: lessonSpec.textContent ?? null,
              externalUrl: lessonSpec.externalUrl ?? null,
              sortOrder: lessonSortOrder,
              isRequired: lessonSpec.isRequired,
              classification: lessonSpec.classification,
            },
          })
        : await prisma.courseLesson.create({
            data: {
              moduleId: module.id,
              title: lessonSpec.title,
              contentType: lessonSpec.contentType,
              textContent: lessonSpec.textContent ?? null,
              externalUrl: lessonSpec.externalUrl ?? null,
              sortOrder: lessonSortOrder,
              isRequired: lessonSpec.isRequired,
              classification: lessonSpec.classification,
            },
          });
      lessonSortOrder += 1;
      lessonsBySlugAndTitle.set(`${moduleSpec.title}::${lessonSpec.title}`, { id: lesson.id });
    }
  }

  return { course, lessonsBySlugAndTitle };
}

async function ensureCourseDepartment(courseId: string, departmentId: string) {
  await prisma.courseDepartment.upsert({
    where: { courseId_departmentId: { courseId, departmentId } },
    update: {},
    create: { courseId, departmentId },
  });
}

async function ensureCourseAccess(courseId: string, userId: string, grantedBy: string) {
  const existing = await prisma.courseAccess.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  if (!existing) {
    await prisma.courseAccess.create({ data: { courseId, userId, grantedBy } });
  } else if (existing.revokedAt !== null) {
    await prisma.courseAccess.update({
      where: { id: existing.id },
      data: { grantedBy, grantedAt: new Date(), revokedBy: null, revokedAt: null },
    });
  }
}

async function ensureLessonProgress(
  userId: string,
  lessonId: string,
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
  startedAt: Date | null,
  completedAt: Date | null,
) {
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { status, startedAt, completedAt },
    create: { userId, lessonId, status, startedAt, completedAt },
  });
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[seed-demo] upserting departments...");
  const departmentIdBySlug = new Map<string, string>();
  for (const spec of DEPARTMENTS) {
    const department = await ensureDepartment(spec);
    departmentIdBySlug.set(spec.slug, department.id);
  }

  console.log("[seed-demo] upserting course categories...");
  const categoryIdByName = new Map<string, string>();
  for (const spec of COURSE_CATEGORIES) {
    const category = await ensureCourseCategory(spec);
    categoryIdByName.set(spec.name, category.id);
  }

  const roles = await prisma.role.findMany({ select: { id: true, code: true } });
  const roleIdByCode = new Map(roles.map((r) => [r.code, r.id]));
  if (!roleIdByCode.has("ADMIN") || !roleIdByCode.has("TRAINER_USER")) {
    throw new Error('Baseline roles missing — run "pnpm run db:seed" (the Phase 1 seed) first.');
  }

  console.log("[seed-demo] upserting demo users (Supabase Auth + profiles)...");
  const userIdByEmail = new Map<string, string>();
  let createdCount = 0;

  // Admin 1 first — it becomes the `createdBy`/`grantedBy`/`assignedBy` actor
  // for every other row this script creates (mirrors how a real admin would
  // set all this up through the UI).
  const admin1 = DEMO_USERS[0]!;
  const admin1Result = await ensureDemoUser(admin1, roleIdByCode, departmentIdBySlug, null);
  userIdByEmail.set(admin1.email, admin1Result.id);
  if (admin1Result.created) createdCount++;

  for (const spec of DEMO_USERS.slice(1)) {
    const result = await ensureDemoUser(spec, roleIdByCode, departmentIdBySlug, admin1Result.id);
    userIdByEmail.set(spec.email, result.id);
    if (result.created) createdCount++;
  }
  const actingAdminId = admin1Result.id;

  console.log("[seed-demo] upserting courses, modules, lessons...");
  const courseByslug = new Map<
    string,
    { id: string; departmentSlug: string; lessonsBySlugAndTitle: Map<string, { id: string }> }
  >();
  for (const spec of COURSES) {
    const { course, lessonsBySlugAndTitle } = await ensureCourse(
      spec,
      actingAdminId,
      categoryIdByName,
    );
    courseByslug.set(spec.slug, {
      id: course.id,
      departmentSlug: spec.departmentSlug,
      lessonsBySlugAndTitle,
    });

    const departmentId = departmentIdBySlug.get(spec.departmentSlug);
    if (!departmentId) throw new Error(`Department "${spec.departmentSlug}" not found.`);
    await ensureCourseDepartment(course.id, departmentId);
  }

  console.log("[seed-demo] granting explicit course access (outside-department example)...");
  // Sales Demo User also gets explicit access to Trainer Fundamentals (a
  // Training-department course) — demonstrates course_access working
  // independently of department membership, alongside the department-based
  // access every other demo user relies on.
  const salesUserId = userIdByEmail.get("sales.demo@example.com")!;
  const trainerFundamentals = courseByslug.get("trainer-fundamentals")!;
  await ensureCourseAccess(trainerFundamentals.id, salesUserId, actingAdminId);

  console.log("[seed-demo] creating lesson progress demo data...");
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  const progressPlans: Array<{
    userEmail: string;
    courseSlug: string;
    entries: Array<{
      moduleTitle: string;
      lessonTitle: string;
      status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
    }>;
  }> = [
    {
      userEmail: "sales.demo@example.com",
      courseSlug: "sales-fundamentals",
      entries: [
        { moduleTitle: "Introduction to Sales", lessonTitle: "Overview", status: "COMPLETED" },
        {
          moduleTitle: "Introduction to Sales",
          lessonTitle: "Further Reading",
          status: "IN_PROGRESS",
        },
        {
          moduleTitle: "Sales in Practice",
          lessonTitle: "Practical Scenario",
          status: "NOT_STARTED",
        },
      ],
    },
    {
      userEmail: "sales.demo@example.com",
      courseSlug: "trainer-fundamentals",
      entries: [
        { moduleTitle: "Introduction to Training", lessonTitle: "Overview", status: "IN_PROGRESS" },
      ],
    },
    {
      userEmail: "recruitment.demo@example.com",
      courseSlug: "recruitment-fundamentals",
      entries: [
        {
          moduleTitle: "Introduction to Recruitment",
          lessonTitle: "Overview",
          status: "COMPLETED",
        },
        {
          moduleTitle: "Introduction to Recruitment",
          lessonTitle: "Further Reading",
          status: "IN_PROGRESS",
        },
        {
          moduleTitle: "Recruitment in Practice",
          lessonTitle: "Practical Scenario",
          status: "NOT_STARTED",
        },
      ],
    },
    {
      userEmail: "training.demo@example.com",
      courseSlug: "trainer-fundamentals",
      entries: [
        { moduleTitle: "Introduction to Training", lessonTitle: "Overview", status: "COMPLETED" },
        {
          moduleTitle: "Introduction to Training",
          lessonTitle: "Further Reading",
          status: "IN_PROGRESS",
        },
        {
          moduleTitle: "Training in Practice",
          lessonTitle: "Practical Scenario",
          status: "NOT_STARTED",
        },
      ],
    },
    {
      userEmail: "operations.demo@example.com",
      courseSlug: "operations-workplace-procedures",
      entries: [
        { moduleTitle: "Introduction to Operations", lessonTitle: "Overview", status: "COMPLETED" },
        {
          moduleTitle: "Introduction to Operations",
          lessonTitle: "Further Reading",
          status: "IN_PROGRESS",
        },
        {
          moduleTitle: "Operations in Practice",
          lessonTitle: "Practical Scenario",
          status: "NOT_STARTED",
        },
      ],
    },
  ];

  let progressCount = 0;
  for (const plan of progressPlans) {
    const userId = userIdByEmail.get(plan.userEmail);
    const course = courseByslug.get(plan.courseSlug);
    if (!userId || !course) continue;
    for (const entry of plan.entries) {
      const lesson = course.lessonsBySlugAndTitle.get(`${entry.moduleTitle}::${entry.lessonTitle}`);
      if (!lesson) continue;
      const startedAt = entry.status === "NOT_STARTED" ? null : twoDaysAgo;
      const completedAt = entry.status === "COMPLETED" ? oneDayAgo : null;
      await ensureLessonProgress(userId, lesson.id, entry.status, startedAt, completedAt);
      progressCount++;
    }
  }

  const [departmentCount, courseCount, moduleCount, lessonCount, accessCount, progressTotal] =
    await Promise.all([
      prisma.department.count({ where: { slug: { in: DEPARTMENTS.map((d) => d.slug) } } }),
      prisma.course.count({ where: { slug: { in: COURSES.map((c) => c.slug) } } }),
      prisma.courseModule.count({
        where: { course: { slug: { in: COURSES.map((c) => c.slug) } } },
      }),
      prisma.courseLesson.count({
        where: { module: { course: { slug: { in: COURSES.map((c) => c.slug) } } } },
      }),
      prisma.courseAccess.count({ where: { userId: { in: [...userIdByEmail.values()] } } }),
      prisma.lessonProgress.count({ where: { userId: { in: [...userIdByEmail.values()] } } }),
    ]);

  console.log("\n[seed-demo] Summary:");
  console.log(`  Departments: ${departmentCount}`);
  console.log(`  Courses: ${courseCount}`);
  console.log(`  Modules: ${moduleCount}`);
  console.log(`  Lessons: ${lessonCount}`);
  console.log(`  Course access records: ${accessCount}`);
  console.log(`  Lesson progress records: ${progressTotal} (${progressCount} touched this run)`);
  console.log(`  Demo Auth users newly created this run: ${createdCount}`);
  console.log("[seed-demo] done.");
}

main()
  .catch((error: unknown) => {
    console.error("[seed-demo] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
