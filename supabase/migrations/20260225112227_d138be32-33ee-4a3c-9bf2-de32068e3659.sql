
-- Table for Radna ploča (workspace board) items
CREATE TABLE public.workspace_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  saved_to_card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workspace_items ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see all workspace items (shared board)
CREATE POLICY "Users can view all workspace items"
  ON public.workspace_items FOR SELECT
  USING (true);

CREATE POLICY "Users can create workspace items"
  ON public.workspace_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update workspace items"
  ON public.workspace_items FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete workspace items"
  ON public.workspace_items FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_workspace_items_updated_at
  BEFORE UPDATE ON public.workspace_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_items;
