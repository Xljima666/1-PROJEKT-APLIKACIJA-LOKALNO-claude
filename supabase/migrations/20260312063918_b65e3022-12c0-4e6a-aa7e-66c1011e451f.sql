
-- FIX: archived_boards SELECT - restrict to admin only
DROP POLICY IF EXISTS "Authenticated users can view archived_boards" ON public.archived_boards;
CREATE POLICY "Admins can view archived_boards" ON public.archived_boards
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- FIX: archived_columns SELECT - restrict to admin only
DROP POLICY IF EXISTS "Authenticated users can view archived_columns" ON public.archived_columns;
CREATE POLICY "Admins can view archived_columns" ON public.archived_columns
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
