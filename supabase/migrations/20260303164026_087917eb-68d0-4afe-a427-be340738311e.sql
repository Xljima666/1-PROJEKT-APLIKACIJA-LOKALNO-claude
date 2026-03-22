-- Update SELECT policy: users can see all non-private items, or their own private items
DROP POLICY IF EXISTS "Users can view all workspace items" ON public.workspace_items;
CREATE POLICY "Users can view workspace items"
  ON public.workspace_items
  FOR SELECT
  TO authenticated
  USING (
    is_private = false
    OR user_id = auth.uid()
  );