-- Fix 1: user_tab_permissions SELECT - change from public to authenticated
DROP POLICY IF EXISTS "Anyone can view tab permissions" ON public.user_tab_permissions;
CREATE POLICY "Authenticated users can view tab permissions"
  ON public.user_tab_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Also fix INSERT/UPDATE/DELETE policies on user_tab_permissions from public to authenticated
DROP POLICY IF EXISTS "Admins can insert tab permissions" ON public.user_tab_permissions;
CREATE POLICY "Admins can insert tab permissions"
  ON public.user_tab_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update tab permissions" ON public.user_tab_permissions;
CREATE POLICY "Admins can update tab permissions"
  ON public.user_tab_permissions
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete tab permissions" ON public.user_tab_permissions;
CREATE POLICY "Admins can delete tab permissions"
  ON public.user_tab_permissions
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: token_usage INSERT - restrict to authenticated with user_id check
DROP POLICY IF EXISTS "Service role can insert token usage" ON public.token_usage;
CREATE POLICY "Authenticated users can insert own token usage"
  ON public.token_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);