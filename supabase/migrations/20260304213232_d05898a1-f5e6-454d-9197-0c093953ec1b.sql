
-- Chat conversations table
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Novi razgovor',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.chat_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations" ON public.chat_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON public.chat_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON public.chat_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Users can create messages in own conversations" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own messages" ON public.chat_messages
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );
