-- 1. Create oauth_nonces table for brain-auth CSRF protection
CREATE TABLE IF NOT EXISTS public.oauth_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.oauth_nonces ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed - only accessed via service role in edge function

-- Auto-cleanup: delete nonces older than 10 minutes via a function
CREATE OR REPLACE FUNCTION public.cleanup_expired_nonces()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.oauth_nonces WHERE created_at < now() - interval '10 minutes';
$$;

-- 2. Fix contact_submissions INSERT policy to add basic validation instead of bare true
DROP POLICY IF EXISTS "Anyone can insert contact submissions" ON public.contact_submissions;
CREATE POLICY "Anyone can insert contact submissions"
  ON public.contact_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(name) > 0 AND length(name) <= 200
    AND length(email) > 0 AND length(email) <= 255
    AND length(message) > 0 AND length(message) <= 5000
  );

-- 3. Move pg_stat_statements extension to extensions schema if it exists in public
DO $$
BEGIN
  -- Try to move extensions from public to extensions schema
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements' AND extnamespace = 'public'::regnamespace) THEN
    ALTER EXTENSION pg_stat_statements SET SCHEMA extensions;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not move extension: %', SQLERRM;
END;
$$;