import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

/**
 * The single authoritative course-access predicate (SYSTEM_PLAN.md §6): a
 * user has effective access to a course if EITHER
 *   1. they hold an active membership in at least one department the course
 *      is assigned to, OR
 *   2. an active (`revoked_at IS NULL`) explicit `course_access` grant exists
 *      for that user/course pair.
 *
 * Expressed as a reusable Prisma `CourseWhereInput` fragment rather than as
 * two imperative existence queries (Unit 2.6's original shape) — refactored
 * in Unit 2.7 specifically so the user-facing catalogue's bulk "which
 * published courses can this user see" query and `canAccessCourse`'s
 * single-course check share the exact same logic *by construction*. Without
 * this, the catalogue would need its own independently-written WHERE clause
 * expressing "the same" rule, which is exactly the "second, independently
 * maintained access rule" this unit was told not to create. The semantics
 * are byte-for-byte unchanged from Unit 2.6 — only the implementation
 * shape changed, and `canAccessCourse`'s public signature/behavior is
 * unaffected (verified by re-running Unit 2.6's own scenarios below).
 *
 * "Active membership" — `user_departments` has no status/active column of
 * its own, so a membership row's mere existence is the signal (unchanged
 * from Unit 2.6). `department.isActive` is still consulted deliberately
 * (Unit 2.6's fail-closed reading, preserved here unchanged).
 */
export function effectiveCourseAccessFilter(userId: string): Prisma.CourseWhereInput {
  return {
    OR: [
      {
        courseDepartments: {
          some: {
            department: {
              isActive: true,
              userDepartments: { some: { userId } },
            },
          },
        },
      },
      {
        accessGrants: {
          some: { userId, revokedAt: null },
        },
      },
    ],
  };
}

/**
 * canAccessCourse (SYSTEM_PLAN.md §6) — public signature and semantics
 * unchanged from Unit 2.6. Now implemented as a single query against the
 * `Course` model using `effectiveCourseAccessFilter`, rather than two
 * separate queries against `UserDepartment`/`CourseAccess` — fewer round
 * trips, and guarantees this and the catalogue query can never drift apart.
 *
 * Fails closed by construction: a nonexistent `courseId` matches no `Course`
 * row at all, and a nonexistent `userId` matches no relation rows in the
 * OR clause — both resolve to `false`, with no separate existence branch
 * to get wrong and no permissive fallback anywhere in this function.
 */
export async function canAccessCourse(userId: string, courseId: string): Promise<boolean> {
  const match = await prisma.course.findFirst({
    where: { id: courseId, ...effectiveCourseAccessFilter(userId) },
    select: { id: true },
  });
  return match !== null;
}

/**
 * The single authoritative resource-visibility predicate (SYSTEM_PLAN.md
 * §14.5/§20, widened by the consistent-granular-access-control unit): a
 * resource is visible to a user if EITHER
 *   1. `resource_departments` has no rows for it at all (empty mapping =
 *      globally visible, §14.5's own literal wording), OR
 *   2. the user holds an active membership in at least one department the
 *      resource IS mapped to, OR
 *   3. an active (`revoked_at IS NULL`) explicit `resource_access` grant
 *      exists for that user/resource pair — byte-for-byte the same shape as
 *      `effectiveCourseAccessFilter`'s own explicit-grant branch, now that
 *      `resource_access` exists (it did not when this predicate was first
 *      written — see this file's git history / the unit that added it).
 *
 * Mirrors `can_view_resource()` (the RLS-side SQL expression of this exact
 * rule, `20260913090000_resources/migration.sql`, widened in lockstep by the
 * same unit) byte-for-byte, for the same "one authoritative predicate,
 * expressed once, reused in both the bulk Prisma filter and RLS" reason
 * `effectiveCourseAccessFilter`/`can_access_course()` are kept in lockstep
 * (§12).
 */
export function effectiveResourceVisibilityFilter(userId: string): Prisma.ResourceWhereInput {
  return {
    OR: [
      { resourceDepartments: { none: {} } },
      {
        resourceDepartments: {
          some: {
            department: {
              isActive: true,
              userDepartments: { some: { userId } },
            },
          },
        },
      },
      {
        accessGrants: {
          some: { userId, revokedAt: null },
        },
      },
    ],
  };
}

/**
 * canViewResource — public signature/semantics mirror `canAccessCourse`
 * exactly, including the same fail-closed-by-construction reasoning: a
 * nonexistent `resourceId` matches no `Resource` row (false), a nonexistent
 * `userId` matches no relation rows in the OR clause (false), no permissive
 * fallback anywhere. Callers are responsible for the separate
 * `status === 'PUBLISHED'` check (this predicate, like
 * `effectiveCourseAccessFilter`, deliberately does not encode status —
 * see this file's own precedent).
 */
export async function canViewResource(userId: string, resourceId: string): Promise<boolean> {
  const match = await prisma.resource.findFirst({
    where: { id: resourceId, ...effectiveResourceVisibilityFilter(userId) },
    select: { id: true },
  });
  return match !== null;
}

/**
 * The single authoritative announcement-visibility predicate (SYSTEM_PLAN.md
 * §14.6/§21, widened by the consistent-granular-access-control unit):
 * byte-for-byte the same shape as `effectiveResourceVisibilityFilter` — an
 * announcement is visible to a user if EITHER `announcement_departments` has
 * no rows for it (empty mapping = globally visible) OR the user holds an
 * active membership in at least one department it IS mapped to OR an active
 * explicit `announcement_access` grant exists for that user/announcement
 * pair. Mirrors `can_view_announcement()` (the RLS-side SQL expression of
 * this exact rule, `20260913150000_announcements/migration.sql`, widened in
 * lockstep) for the same "one authoritative predicate, reused in both the
 * bulk Prisma filter and RLS" reason as every other visibility predicate in
 * this file (§12).
 */
export function effectiveAnnouncementVisibilityFilter(
  userId: string,
): Prisma.AnnouncementWhereInput {
  return {
    OR: [
      { announcementDepartments: { none: {} } },
      {
        announcementDepartments: {
          some: {
            department: {
              isActive: true,
              userDepartments: { some: { userId } },
            },
          },
        },
      },
      {
        accessGrants: {
          some: { userId, revokedAt: null },
        },
      },
    ],
  };
}

/**
 * canViewAnnouncement — public signature/semantics mirror `canViewResource`
 * exactly, including the same fail-closed-by-construction reasoning and the
 * same "callers check `status === 'PUBLISHED'` separately" division of
 * responsibility.
 */
export async function canViewAnnouncement(
  userId: string,
  announcementId: string,
): Promise<boolean> {
  const match = await prisma.announcement.findFirst({
    where: { id: announcementId, ...effectiveAnnouncementVisibilityFilter(userId) },
    select: { id: true },
  });
  return match !== null;
}

/**
 * The single authoritative policy-visibility predicate (consistent-granular-
 * access-control unit, §7, widened by explicit per-user policy access).
 * Byte-for-byte the same shape as `effectiveResourceVisibilityFilter` — a
 * policy is visible to a user if EITHER `policy_departments` has no rows for
 * it at all (empty mapping = globally visible) OR the user holds an active
 * membership in at least one active department it IS mapped to OR an active
 * (`revoked_at IS NULL`) explicit `policy_access` grant exists for that
 * user/policy. A revoked grant confers nothing. Mirrors `can_view_policy()`
 * (the RLS-side SQL expression of this exact rule) for the same "one
 * authoritative predicate, reused in both the bulk Prisma filter and RLS"
 * reason as every other visibility predicate in this file (§12).
 */
export function effectivePolicyVisibilityFilter(userId: string): Prisma.PolicyWhereInput {
  return {
    OR: [
      { policyDepartments: { none: {} } },
      {
        policyDepartments: {
          some: {
            department: {
              isActive: true,
              userDepartments: { some: { userId } },
            },
          },
        },
      },
      {
        accessGrants: {
          some: { userId, revokedAt: null },
        },
      },
    ],
  };
}

/**
 * canViewPolicy — public signature/semantics mirror `canViewResource`
 * exactly, including the same fail-closed-by-construction reasoning.
 * Callers are responsible for any separate "has an active version" check
 * (this predicate, like the others in this file, deliberately does not
 * encode that — see policies.service.ts's own `withActiveVersion`).
 */
export async function canViewPolicy(userId: string, policyId: string): Promise<boolean> {
  const match = await prisma.policy.findFirst({
    where: { id: policyId, ...effectivePolicyVisibilityFilter(userId) },
    select: { id: true },
  });
  return match !== null;
}
