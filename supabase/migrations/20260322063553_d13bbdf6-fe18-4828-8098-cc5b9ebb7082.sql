-- Update SELECT policy to allow users with 'privatne-biljeske-sve' permission to see all items
DROP POLICY "Users can view workspace items" ON public.workspace_items;
CREATE POLICY "Users can view workspace items" ON public.workspace_items
FOR SELECT TO authenticated
USING (
  is_private = false
  OR user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_tab_permission(auth.uid(), 'privatne-biljeske-sve'::text)
);