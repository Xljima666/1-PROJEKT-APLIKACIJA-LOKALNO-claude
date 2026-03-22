
DROP POLICY IF EXISTS "Users can view related cards or admin all" ON public.cards;

CREATE POLICY "All authenticated can view cards"
  ON public.cards FOR SELECT
  TO authenticated
  USING (true);
