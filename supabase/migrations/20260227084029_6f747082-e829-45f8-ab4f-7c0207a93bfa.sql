
-- Add geodetic work fields to cards table
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS kontakt text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS narucitelj_ime text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS narucitelj_adresa text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS narucitelj_oib text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS adresa_cestice text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS postanski_broj text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS katastarska_opcina text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS katastarska_cestica text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS vrsta_posla text[] DEFAULT '{}';
