
-- FIX ERROR: comments SELECT - restrict to card-level access
DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.comments;
CREATE POLICY "Users can view comments for accessible cards" ON public.comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = comments.card_id
      AND (has_role(auth.uid(), 'admin'::app_role) OR c.created_by = auth.uid() OR c.assigned_to = auth.uid())
    )
  );

-- FIX WARN: user_tab_permissions SELECT - restrict to own or admin
DROP POLICY IF EXISTS "Authenticated users can view tab permissions" ON public.user_tab_permissions;
CREATE POLICY "Users can view own permissions or admin all" ON public.user_tab_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
