
-- Fix workspace_items SELECT policy: change from public to authenticated
DROP POLICY IF EXISTS "Users can view workspace items" ON public.workspace_items;
CREATE POLICY "Users can view workspace items"
  ON public.workspace_items
  FOR SELECT
  TO authenticated
  USING (
    (is_private = false)
    OR (user_id = auth.uid())
    OR (is_private = true AND has_role(auth.uid(), 'admin'::app_role))
    OR (
      is_private = true
      AND EXISTS (
        SELECT 1 FROM user_tab_permissions
        WHERE user_tab_permissions.user_id = auth.uid()
          AND user_tab_permissions.tab_key = 'privatne-biljeske'
      )
      AND EXISTS (
        SELECT 1 FROM user_tab_permissions
        WHERE user_tab_permissions.user_id = workspace_items.user_id
          AND user_tab_permissions.tab_key = 'privatne-biljeske'
      )
    )
  );
