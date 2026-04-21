-- =====================================================================
-- HOTFIX: dodaj email u profiles + postavi Marka kao admina
-- Pokreni u Supabase SQL Editoru NAKON prethodne migracije
-- =====================================================================

-- 1) Dodaj kolonu email u profiles (ako već ne postoji)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- 2) Backfill — popuni email iz auth.users za sve postojeće profile
UPDATE public.profiles p
   SET email = u.email
  FROM auth.users u
 WHERE p.user_id = u.id
   AND (p.email IS NULL OR p.email = '');

-- 3) Trigger — automatski sinkroniziraj email kad se napravi novi profil
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' THEN
    SELECT email INTO NEW.email FROM auth.users WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_profile_email_sync ON public.profiles;
CREATE TRIGGER tr_profile_email_sync
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- 4) Postavi Marka Petronijevića kao admina
--    (pronalazi user_id preko emaila u auth.users)
DO $$
DECLARE
  marko_id uuid;
BEGIN
  SELECT id INTO marko_id
    FROM auth.users
   WHERE lower(email) = 'markopetronijevic666@gmail.com'
   LIMIT 1;

  IF marko_id IS NULL THEN
    RAISE NOTICE 'Korisnik markopetronijevic666@gmail.com nije pronađen u auth.users';
  ELSE
    -- Postavi ulogu admin bez oslanjanja na UNIQUE(user_id).
    -- Starija shema ima UNIQUE(user_id, role), pa ON CONFLICT(user_id) puca.
    DELETE FROM public.user_roles
     WHERE user_id = marko_id
       AND role <> 'admin';

    INSERT INTO public.user_roles (user_id, role)
    SELECT marko_id, 'admin'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = marko_id AND role = 'admin'
    );

    -- Pobrini se da je profil "root" (bez admin_user_id)
    UPDATE public.profiles
       SET admin_user_id = NULL,
           email = COALESCE(email, 'markopetronijevic666@gmail.com')
     WHERE user_id = marko_id;

    -- Ako profil ne postoji, napravi ga bez oslanjanja na constraint ime.
    INSERT INTO public.profiles (user_id, email, admin_user_id)
    SELECT marko_id, 'markopetronijevic666@gmail.com', NULL
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = marko_id
    );

    RAISE NOTICE 'Marko postavljen kao admin, user_id = %', marko_id;
  END IF;
END $$;

-- 5) Provjera — trebao bi vidjeti 1 red s role='admin'
SELECT u.email, r.role, p.admin_user_id IS NULL AS is_root
  FROM auth.users u
  LEFT JOIN public.user_roles r ON r.user_id = u.id
  LEFT JOIN public.profiles p ON p.user_id = u.id
 WHERE lower(u.email) = 'markopetronijevic666@gmail.com';
