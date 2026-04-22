-- Restore RLS on user_roles without recursive policy evaluation.
-- Policies on user_roles must not call has_role/is_admin because those helpers
-- read user_roles. Owner management uses JWT email only, so it cannot recurse.

DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.user_roles',
      existing_policy.policyname
    );
  END LOOP;
END $$;

ALTER TABLE public.user_roles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_read_authenticated" ON public.user_roles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "user_roles_owner_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    lower(coalesce(auth.jwt() ->> 'email', '')) IN (
      'markopetronijevic666@gmail.com'
    )
  )
  WITH CHECK (
    lower(coalesce(auth.jwt() ->> 'email', '')) IN (
      'markopetronijevic666@gmail.com'
    )
  );
