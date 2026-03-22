
-- FIX ERROR: attachments SELECT - restrict to card-level access
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON public.attachments;
CREATE POLICY "Users can view attachments for accessible cards" ON public.attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = attachments.card_id
      AND (has_role(auth.uid(), 'admin'::app_role) OR c.created_by = auth.uid() OR c.assigned_to = auth.uid())
    )
  );

-- FIX WARN: user_roles SELECT - restrict to own record or admin
DROP POLICY IF EXISTS "Users can view roles" ON public.user_roles;
CREATE POLICY "Users can view own roles or admin all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- FIX remaining RLS Always True: contact_submissions INSERT (anon)
-- This is intentional for public contact form, but let's keep it and dismiss

-- FIX WARN: workspace_items - the is_private=false sharing is by design for the workboard
-- But we can keep it since it's the intended behavior for team collaboration
