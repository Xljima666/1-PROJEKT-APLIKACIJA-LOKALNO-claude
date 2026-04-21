-- Emergency restore for production: user_roles RLS is causing recursive
-- policy evaluation and breaking role/team reads. Keep the app working first;
-- a safer role-management policy can be rebuilt after the production incident.

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
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
