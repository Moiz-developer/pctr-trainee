import "dotenv/config";
import { prismaPrivileged as prisma } from "../lib/prisma-privileged.js";

// Baseline seed for Phase 1 — Identity & Access (SYSTEM_PLAN.md §5, §37).
//
// Permission catalogue note: SYSTEM_PLAN.md does not define a complete/final
// permission catalogue anywhere — it only references permission codes as
// scattered examples across §5, §10, §16, and the §26 API endpoint table
// (plus one example tied to an explicitly open question, §Open Questions #5).
// This seed includes exactly the codes that literally appear in the
// document. It is NOT a complete catalogue — future implementation units
// (courses, assessments, resources, announcements, queries, policies, media)
// will add further permission codes as those modules are built.
const PERMISSIONS: ReadonlyArray<{ code: string; description: string }> = [
  { code: "course.create", description: "Create courses (§5, §14.1 example)." },
  {
    code: "course.view",
    description: "View courses within one's authorized scope (§26, marked implicit).",
  },
  { code: "course.delete", description: "Delete courses (§10 example)." },
  {
    code: "course.content.manage",
    description: "Manage course content, including uploading course media (§16).",
  },
  {
    code: "course.access.manage",
    description: "Grant/revoke explicit user-level course access (§26).",
  },
  { code: "user.create", description: "Create users via the Supabase invite flow (§26)." },
  { code: "user.manage", description: "Manage users, including status changes (§5, §26)." },
  { code: "department.manage", description: "Create/update/deactivate departments (§26)." },
  { code: "announcement.publish", description: "Publish announcements (§5 example)." },
  {
    code: "announcement.manage",
    description:
      "Create/update/archive announcements (drafts and their content/attachment/image), and set an announcement's department targeting (§14.6/§21). Not a code named in SYSTEM_PLAN.md's text (only announcement.publish is) — added following this seed's own established convention of one permission per admin-write feature, deliberately kept separate from announcement.publish per this phase's own instruction to reuse that existing permission where appropriate (the DRAFT->PUBLISHED transition specifically) rather than folding everything into one code.",
  },
  { code: "policy.version.activate", description: "Activate a policy version (§5 example)." },
  {
    code: "policy.manage",
    description:
      "Create/update policies and policy versions, and upload/replace their attached documents (§14.8/§23). Not a code named in SYSTEM_PLAN.md's text (only policy.version.activate is) — added following this seed's own established convention of one permission per admin-write feature, deliberately kept separate from policy.version.activate per this phase's own instruction to use that existing permission specifically for activation.",
  },
  { code: "query.manage", description: "Manage and respond to all users' support queries (§26)." },
  {
    code: "resource.manage",
    description:
      "Create/update/archive resources and resource categories, and set a resource's department visibility (§14.5/§20). Not a code named in SYSTEM_PLAN.md's text; added following this seed's own established convention of one permission per admin-write feature, mirroring query.manage/training.manage/assessment.manage.",
  },
  {
    code: "assessment.grade",
    description:
      "Grade PRACTICAL_MANUAL (and, per this implementation's documented extension, SHORT_ANSWER — §19 leaves it unautomated) assessment answers (§Open Questions #5 — assumed Admin Portal capability; exact role ownership not yet finalized).",
  },
  {
    code: "training.manage",
    description:
      "Configure training_hour_requirements (§14.3). Not a code named in SYSTEM_PLAN.md's text (no permission catalogue entry exists for this table); added following this seed's own established convention of one permission per admin-write table, mirroring department.manage/course.access.manage.",
  },
  {
    code: "assessment.manage",
    description:
      "Create/update assessments, questions, and options (§14.4). Not a code named in SYSTEM_PLAN.md's text (only assessment.grade is); added following the same one-permission-per-admin-write-feature convention as training.manage.",
  },
  {
    code: "role.manage",
    description:
      "Create/update roles and manage which permissions a role holds (§5/§10 — Admin Role & Permission Management). Not a code named in SYSTEM_PLAN.md's text; added following this seed's own established convention of one permission per admin-write feature, mirroring resource.manage/query.manage/policy.manage.",
  },
  {
    code: "system.manage",
    description:
      "Update system_settings — media MIME allowlists, per-purpose size limits, signed-URL TTLs, and the video completion threshold (§14.9/§16 — Admin Portal / System Settings). Not a code named in SYSTEM_PLAN.md's text; added following this seed's own established convention of one permission per admin-write feature.",
  },
];

const ROLES: ReadonlyArray<{ code: string; name: string; description: string; isSystem: boolean }> =
  [
    {
      code: "ADMIN",
      name: "Administrator",
      description: "Full-access system role; holds every baseline permission (§5).",
      isSystem: true,
    },
    {
      code: "TRAINER_USER",
      name: "Trainer / Employee",
      description: "The trainee/learner role being trained (§5).",
      isSystem: false,
    },
  ];

async function main(): Promise<void> {
  console.log("[seed] upserting roles...");
  const roleByCode = new Map<string, { id: string }>();
  for (const role of ROLES) {
    const row = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description, isSystem: role.isSystem },
      create: role,
    });
    roleByCode.set(role.code, row);
  }

  console.log("[seed] upserting permissions...");
  const permissionByCode = new Map<string, { id: string }>();
  for (const permission of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
    permissionByCode.set(permission.code, row);
  }

  console.log("[seed] granting ADMIN every baseline permission...");
  const admin = roleByCode.get("ADMIN")!;
  for (const permission of PERMISSIONS) {
    const perm = permissionByCode.get(permission.code)!;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: admin.id, permissionId: perm.id } },
      update: {},
      create: { roleId: admin.id, permissionId: perm.id },
    });
  }

  console.log(
    "[seed] Skipping default ADMIN profile: a profiles row requires a corresponding " +
      "Supabase auth.users row (profiles.id -> auth.users.id, ON DELETE CASCADE), and " +
      "this repository has no Supabase Auth admin-SDK integration yet — out of scope for " +
      "this implementation unit (see its report). Provision the first admin profile via " +
      "the Supabase invite flow once that unit exists.",
  );

  console.log("[seed] done.");
}

main()
  .catch((error: unknown) => {
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
