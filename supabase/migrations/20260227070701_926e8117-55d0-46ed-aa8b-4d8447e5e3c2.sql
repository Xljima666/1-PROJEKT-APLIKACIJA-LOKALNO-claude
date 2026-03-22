
-- Add status field to cards for workflow status tracking
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS status text DEFAULT NULL;

-- Add parent_card_id for sub-cards hierarchy
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS parent_card_id uuid DEFAULT NULL REFERENCES public.cards(id) ON DELETE CASCADE;
