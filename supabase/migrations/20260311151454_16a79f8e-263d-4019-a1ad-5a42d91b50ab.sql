-- Fix 1: Change calendar_events SELECT policy from public to authenticated
DROP POLICY IF EXISTS "Users can view all calendar events" ON public.calendar_events;
CREATE POLICY "Users can view all calendar events"
  ON public.calendar_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Fix 2: Remove dangerous service role policy on sdge_notifications
DROP POLICY IF EXISTS "Service role full access on sdge_notifications" ON public.sdge_notifications;