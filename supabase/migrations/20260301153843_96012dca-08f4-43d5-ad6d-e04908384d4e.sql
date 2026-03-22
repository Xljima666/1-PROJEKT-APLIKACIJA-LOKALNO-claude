
-- Allow admin to delete any workspace item
DROP POLICY "Users can delete workspace items" ON public.workspace_items;

CREATE POLICY "Users can delete own or admin all workspace items"
ON public.workspace_items
FOR DELETE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to update any workspace item
DROP POLICY "Users can update workspace items" ON public.workspace_items;

CREATE POLICY "Users can update own or admin all workspace items"
ON public.workspace_items
FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
