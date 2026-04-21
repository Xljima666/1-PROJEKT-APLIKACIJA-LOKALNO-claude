-- Stop user_roles RLS recursion.
-- user_roles policies must not call has_role/is_admin because those helpers read
-- user_roles and Postgres detects that as recursive policy evaluation.

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compat_user_roles_select_self_or_admin" ON public.user_roles;
DROP POLICY IF EXISTS "compat_user_roles_admin_manage" ON public.user_roles;
DROP POLICY IF EXISTS "roles_select_self_or_admin" ON public.user_roles;
DROP POLICY IF EXISTS "roles_admin_write" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles" ON public.user_roles;

CREATE POLICY "Users can view roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "owner_can_manage_roles" ON public.user_roles;
CREATE POLICY "owner_can_manage_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE id = auth.uid()
        AND lower(email) IN ('markopetronijevic666@gmail.com')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE id = auth.uid()
        AND lower(email) IN ('markopetronijevic666@gmail.com')
    )
  );
