
-- Drop existing restrictive DELETE policy
DROP POLICY IF EXISTS "Users can delete their own events" ON public.calendar_events;

-- Allow users to delete their own events OR admins to delete any
CREATE POLICY "Users can delete own events or admin all"
ON public.calendar_events
FOR DELETE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
