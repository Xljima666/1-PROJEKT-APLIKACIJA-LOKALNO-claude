-- Add assigned_to for team member who works on the card
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS assigned_to uuid DEFAULT NULL;