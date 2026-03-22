
-- Allow all authenticated users to update public workspace items
-- Private items remain owner-only
DROP POLICY IF EXISTS "Users can update own workspace items" ON public.workspace_items;
CREATE POLICY "Users can update workspace items"
  ON public.workspace_items
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR is_private = false
  )
  WITH CHECK (
    auth.uid() = user_id OR is_private = false
  );
