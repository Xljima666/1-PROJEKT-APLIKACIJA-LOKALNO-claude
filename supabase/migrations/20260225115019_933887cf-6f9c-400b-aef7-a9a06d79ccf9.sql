
-- Table to store Google OAuth tokens for Gmail access
CREATE TABLE public.google_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- Only users can see/manage their own tokens
CREATE POLICY "Users can view own tokens" ON public.google_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tokens" ON public.google_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tokens" ON public.google_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tokens" ON public.google_tokens FOR DELETE USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_google_tokens_updated_at
  BEFORE UPDATE ON public.google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
