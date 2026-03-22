
DROP POLICY IF EXISTS "All authenticated can view cards" ON public.cards;

CREATE POLICY "Users can view related cards or admin all"
  ON public.cards FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR (assigned_to = auth.uid()));
