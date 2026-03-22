-- Fix archived_cards sensitive data exposure
DROP POLICY IF EXISTS "Authenticated users can view archived_cards" ON public.archived_cards;

CREATE POLICY "Users can view own archived_cards or admin"
ON public.archived_cards
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
);

-- Fix calendar_events cross-user read exposure
DROP POLICY IF EXISTS "Users can view all calendar events" ON public.calendar_events;

CREATE POLICY "Users can view own calendar events or admin"
ON public.calendar_events
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR user_id = auth.uid()
);