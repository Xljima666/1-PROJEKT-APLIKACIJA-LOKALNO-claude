CREATE POLICY "Authenticated users can delete archived_cards"
ON public.archived_cards
FOR DELETE
TO authenticated
USING (true);