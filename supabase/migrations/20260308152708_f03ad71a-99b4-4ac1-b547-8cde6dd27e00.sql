-- Update RLS policy on workspace_items to allow users with 'privatne-biljeske' permission to see other users' private items
DROP POLICY IF EXISTS "Users can view workspace items" ON public.workspace_items;

CREATE POLICY "Users can view workspace items"
ON public.workspace_items
FOR SELECT
USING (
  (is_private = false)
  OR (user_id = auth.uid())
  OR (
    is_private = true
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.user_tab_permissions
        WHERE user_tab_permissions.user_id = auth.uid()
          AND user_tab_permissions.tab_key = 'privatne-biljeske'
      )
    )
  )
);