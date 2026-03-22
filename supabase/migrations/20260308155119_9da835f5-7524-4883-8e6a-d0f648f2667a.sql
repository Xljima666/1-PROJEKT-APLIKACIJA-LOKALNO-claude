DROP POLICY IF EXISTS "Users can update own or admin all workspace items" ON public.workspace_items;
DROP POLICY IF EXISTS "Users can delete own or admin all workspace items" ON public.workspace_items;

CREATE POLICY "Users can update own workspace items" ON public.workspace_items
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspace items" ON public.workspace_items
FOR DELETE
USING (auth.uid() = user_id);