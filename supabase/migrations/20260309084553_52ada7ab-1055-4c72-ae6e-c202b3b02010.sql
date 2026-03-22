
CREATE TABLE public.token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  model text NOT NULL DEFAULT 'grok-4-1-fast-reasoning',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own token usage" ON public.token_usage
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert token usage" ON public.token_usage
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_token_usage_user_id ON public.token_usage(user_id);
CREATE INDEX idx_token_usage_created_at ON public.token_usage(created_at);
