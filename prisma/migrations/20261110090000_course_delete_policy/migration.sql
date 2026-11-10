CREATE POLICY courses_delete ON public.courses
FOR DELETE TO app_api
USING (
  status IN ('DRAFT', 'ARCHIVED')
  AND public.has_permission('course.view')
  AND public.has_permission('course.delete')
);
