
CREATE TABLE public.google_brain_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_brain_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brain tokens" ON public.google_brain_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own brain tokens" ON public.google_brain_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own brain tokens" ON public.google_brain_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own brain tokens" ON public.google_brain_tokens FOR DELETE USING (auth.uid() = user_id);
