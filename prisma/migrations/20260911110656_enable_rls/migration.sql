-- Phase 2H: RLS + non-bypassing Supabase DB role.
--
-- 1. A dedicated `app_api` role (NOBYPASSRLS) — the API's actual runtime
--    connection (lib/prisma.ts) from now on. Created NOLOGIN here
--    deliberately: this migration file is committed to source control, and
--    a role with no password cannot be connected to by anyone. The real
--    login password is set separately, out-of-band, via `ALTER ROLE
--    app_api WITH LOGIN PASSWORD '...'` run directly against the database
--    (never committed) — see this unit's implementation report. Re-running
--    this migration is safe: role creation is idempotent, and it never
--    touches (or resets) whatever password has already been set.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_api') THEN
    CREATE ROLE app_api NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_api;

-- 2. Helper functions mirroring authorization/access.service.ts and
-- authorization.middleware.ts's requirePermission() exactly (SYSTEM_PLAN.md
-- §12: "RLS policies are literal SQL translations of the same
-- access.service.ts logic the API uses"). SECURITY DEFINER + a pinned
-- search_path: these must be able to read profiles/role_permissions/
-- course_departments/user_departments/course_access regardless of the
-- CALLING role's own RLS-restricted view of those same tables (otherwise a
-- permission check could wrongly fail simply because the checking role
-- can't see the very rows that would prove it should pass — a classic RLS
-- circular-dependency trap). Both are STABLE, not VOLATILE: their result
-- only depends on table contents for the duration of one statement/
-- transaction, matching how they're actually used (one short-lived
-- request-scoped transaction per query — see lib/prisma.ts).

CREATE OR REPLACE FUNCTION public.has_permission(perm_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN role_permissions rp ON rp.role_id = p.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE p.id = auth.uid()
      AND p.status = 'ACTIVE'
      AND perm.code = perm_code
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_course(target_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM course_departments cd
    JOIN departments d ON d.id = cd.department_id
    JOIN user_departments ud ON ud.department_id = d.id
    WHERE cd.course_id = target_course_id
      AND d.is_active = true
      AND ud.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM course_access ca
    WHERE ca.course_id = target_course_id
      AND ca.user_id = auth.uid()
      AND ca.revoked_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(text) TO app_api;
GRANT EXECUTE ON FUNCTION public.can_access_course(uuid) TO app_api;

-- 3. Enable RLS + policies on every current application table.
--
-- No table gets a DELETE policy anywhere below: this schema has no hard
-- deletes at all (SYSTEM_PLAN.md §13 "soft-delete/archive over hard
-- delete"), so the complete absence of a DELETE policy is itself the
-- correct, fail-closed mirror of that rule — RLS's own default (deny
-- unless a matching policy exists) blocks it automatically.
--
-- Reference/lookup tables (roles, permissions, role_permissions,
-- departments, course_departments, course_categories): readable by any
-- authenticated caller. None of these expose sensitive data on their own
-- (role/permission code strings, department/category names, which
-- department a course belongs to), and several non-admin read paths
-- legitimately traverse them via joins for access resolution to work at
-- all (e.g. a trainee's own effective-course-access check joins through
-- course_departments/departments/user_departments) — restricting SELECT on
-- these to admins would break those paths, not protect anything.

-- roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_select ON roles FOR SELECT USING (auth.uid() IS NOT NULL);

-- permissions
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissions_select ON permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- role_permissions
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_select ON role_permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- departments (read: any authenticated user; write: department.manage — matches departments.routes.ts exactly)
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY departments_select ON departments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY departments_insert ON departments FOR INSERT WITH CHECK (has_permission('department.manage'));
CREATE POLICY departments_update ON departments FOR UPDATE USING (has_permission('department.manage')) WITH CHECK (has_permission('department.manage'));

-- user_departments (read: own memberships, or user.manage/department.manage admin views; write: department.manage — matches users.routes.ts's assign-department route)
ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_departments_select ON user_departments FOR SELECT USING (
  user_id = auth.uid() OR has_permission('user.manage') OR has_permission('department.manage')
);
CREATE POLICY user_departments_insert ON user_departments FOR INSERT WITH CHECK (has_permission('department.manage'));

-- course_departments (read: any authenticated user — needed by can_access_course()'s own join, and by course-catalogue resolution; write: department.manage — matches course-departments.routes.ts)
ALTER TABLE course_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_departments_select ON course_departments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY course_departments_insert ON course_departments FOR INSERT WITH CHECK (has_permission('department.manage'));
CREATE POLICY course_departments_delete ON course_departments FOR DELETE USING (has_permission('department.manage'));

-- course_categories (read: any authenticated user — needed to resolve a course's category name in the user-facing catalogue; write: course.create — matches course-categories.routes.ts)
ALTER TABLE course_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_categories_select ON course_categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY course_categories_insert ON course_categories FOR INSERT WITH CHECK (has_permission('course.create'));
CREATE POLICY course_categories_update ON course_categories FOR UPDATE USING (has_permission('course.create')) WITH CHECK (has_permission('course.create'));

-- profiles (own row, or user.manage/user.create admin — matches users.routes.ts exactly)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON profiles FOR SELECT USING (id = auth.uid() OR has_permission('user.manage'));
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (has_permission('user.create'));
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (id = auth.uid() OR has_permission('user.manage')) WITH CHECK (id = auth.uid() OR has_permission('user.manage'));

-- courses (read: course.view admin, or PUBLISHED + effective access — mirrors user-courses.service.ts's listUserCourses/getUserCourseDetail exactly; write: course.create/course.delete — matches courses.routes.ts)
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY courses_select ON courses FOR SELECT USING (
  has_permission('course.view')
  OR (status = 'PUBLISHED' AND can_access_course(id))
);
CREATE POLICY courses_insert ON courses FOR INSERT WITH CHECK (has_permission('course.create'));
CREATE POLICY courses_update ON courses FOR UPDATE USING (has_permission('course.create') OR has_permission('course.delete')) WITH CHECK (has_permission('course.create') OR has_permission('course.delete'));

-- course_modules (read: course.view admin, or is_active + parent course PUBLISHED+accessible — mirrors getUserCourseDetail's module filter; write: course.create — matches course-modules.routes.ts)
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_modules_select ON course_modules FOR SELECT USING (
  has_permission('course.view')
  OR (
    is_active
    AND EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_modules.course_id
        AND c.status = 'PUBLISHED'
        AND can_access_course(c.id)
    )
  )
);
CREATE POLICY course_modules_insert ON course_modules FOR INSERT WITH CHECK (has_permission('course.create'));
CREATE POLICY course_modules_update ON course_modules FOR UPDATE USING (has_permission('course.create')) WITH CHECK (has_permission('course.create'));

-- course_lessons (read: course.view admin, or is_active + active parent module + PUBLISHED/accessible course — mirrors getUserCourseDetail's lesson filter; write: course.create (create/update) or course.content.manage (media attach) — matches course-lessons.routes.ts)
ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_lessons_select ON course_lessons FOR SELECT USING (
  has_permission('course.view')
  OR (
    is_active
    AND EXISTS (
      SELECT 1 FROM course_modules cm
      JOIN courses c ON c.id = cm.course_id
      WHERE cm.id = course_lessons.module_id
        AND cm.is_active
        AND c.status = 'PUBLISHED'
        AND can_access_course(c.id)
    )
  )
);
CREATE POLICY course_lessons_insert ON course_lessons FOR INSERT WITH CHECK (has_permission('course.create'));
CREATE POLICY course_lessons_update ON course_lessons FOR UPDATE USING (has_permission('course.create') OR has_permission('course.content.manage')) WITH CHECK (has_permission('course.create') OR has_permission('course.content.manage'));

-- course_access (read: own grants, or course.access.manage admin; write: course.access.manage — matches course-access.routes.ts. revoked_at is never independently checked here: a revoked grant is still exactly the row the OWNING user's own history — can_access_course() is what excludes it from counting as access)
ALTER TABLE course_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_access_select ON course_access FOR SELECT USING (
  user_id = auth.uid() OR has_permission('course.access.manage')
);
CREATE POLICY course_access_insert ON course_access FOR INSERT WITH CHECK (has_permission('course.access.manage'));
CREATE POLICY course_access_update ON course_access FOR UPDATE USING (has_permission('course.access.manage')) WITH CHECK (has_permission('course.access.manage'));

-- media_assets (read: course.content.manage admin, or referenced by an active lesson/thumbnail of a PUBLISHED+accessible course — mirrors media.service.ts's getMediaAccessUrl exactly; write: course.content.manage — matches media.routes.ts)
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_assets_select ON media_assets FOR SELECT USING (
  has_permission('course.content.manage')
  OR EXISTS (
    SELECT 1 FROM course_lessons cl
    JOIN course_modules cm ON cm.id = cl.module_id
    JOIN courses c ON c.id = cm.course_id
    WHERE cl.media_asset_id = media_assets.id
      AND cl.is_active AND cm.is_active AND c.status = 'PUBLISHED'
      AND can_access_course(c.id)
  )
  OR EXISTS (
    SELECT 1 FROM courses c
    WHERE c.thumbnail_media_id = media_assets.id
      AND c.status = 'PUBLISHED'
      AND can_access_course(c.id)
  )
);
CREATE POLICY media_assets_insert ON media_assets FOR INSERT WITH CHECK (has_permission('course.content.manage'));

-- lesson_progress (strictly self-only, both read and write — matches progress.service.ts exactly; no admin oversight endpoint exists yet)
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY lesson_progress_select ON lesson_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY lesson_progress_insert ON lesson_progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY lesson_progress_update ON lesson_progress FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
