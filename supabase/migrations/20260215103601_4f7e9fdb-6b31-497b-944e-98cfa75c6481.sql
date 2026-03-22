
-- Archive table for boards
CREATE TABLE public.archived_boards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  background_color text,
  created_by uuid,
  original_created_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid
);

ALTER TABLE public.archived_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view archived_boards"
ON public.archived_boards FOR SELECT USING (true);

CREATE POLICY "Admins can create archived_boards"
ON public.archived_boards FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete archived_boards"
ON public.archived_boards FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Archive table for cards
CREATE TABLE public.archived_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  column_title text,
  board_id uuid,
  board_title text,
  created_by uuid,
  original_created_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid
);

ALTER TABLE public.archived_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view archived_cards"
ON public.archived_cards FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create archived_cards"
ON public.archived_cards FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can delete archived_cards"
ON public.archived_cards FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Archive table for columns
CREATE TABLE public.archived_columns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_id uuid NOT NULL,
  title text NOT NULL,
  board_id uuid,
  board_title text,
  position integer,
  original_created_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid
);

ALTER TABLE public.archived_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view archived_columns"
ON public.archived_columns FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create archived_columns"
ON public.archived_columns FOR INSERT WITH CHECK (true);
