DROP POLICY IF EXISTS "Users can view own calendar events or admin" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can update their own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can delete own events or admin all" ON public.calendar_events;

CREATE POLICY "All authenticated can view calendar events"
  ON public.calendar_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated can update calendar events"
  ON public.calendar_events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "All authenticated can delete calendar events"
  ON public.calendar_events FOR DELETE
  TO authenticated
  USING (true);