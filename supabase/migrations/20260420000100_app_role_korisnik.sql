-- Ensure the team-management role value exists before migrations use it.
-- Kept separate because newly added enum values are safest to use
-- after the migration transaction that adds them has committed.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'korisnik';
