-- Restore write access for workspace notes after the access policy reset.
-- Users can create, edit, archive, and delete their own notes.

ALTER TABLE public.workspace_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create workspace items" ON public.workspace_items;
DROP POLICY IF EXISTS "restore_workspace_items_insert_own" ON public.workspace_items;
CREATE POLICY "restore_workspace_items_insert_own" ON public.workspace_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update workspace items" ON public.workspace_items;
DROP POLICY IF EXISTS "Users can update own workspace items" ON public.workspace_items;
DROP POLICY IF EXISTS "Users can update own or admin all workspace items" ON public.workspace_items;
DROP POLICY IF EXISTS "restore_workspace_items_update_own" ON public.workspace_items;
CREATE POLICY "restore_workspace_items_update_own" ON public.workspace_items
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete workspace items" ON public.workspace_items;
DROP POLICY IF EXISTS "Users can delete own workspace items" ON public.workspace_items;
DROP POLICY IF EXISTS "Users can delete own or admin all workspace items" ON public.workspace_items;
DROP POLICY IF EXISTS "restore_workspace_items_delete_own" ON public.workspace_items;
CREATE POLICY "restore_workspace_items_delete_own" ON public.workspace_items
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
