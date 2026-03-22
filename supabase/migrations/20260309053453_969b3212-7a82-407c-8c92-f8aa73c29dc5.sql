
-- 1. Fix: Drop overly permissive anon SELECT on invitations
DROP POLICY IF EXISTS "Users can view invitations for their email" ON public.invitations;

-- Create a restricted policy: only authenticated users can view invitations matching their email
CREATE POLICY "Authenticated users can view own invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (email = (auth.jwt() ->> 'email'));

-- 2. Fix: Drop overly permissive public SELECT on push_subscriptions
DROP POLICY IF EXISTS "Service can read all subscriptions" ON public.push_subscriptions;
