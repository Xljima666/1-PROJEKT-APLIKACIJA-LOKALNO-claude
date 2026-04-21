-- =====================================================================
-- Tim / Team — Supabase migracija
-- Pokreni u Supabase SQL Editoru (dashboard → SQL → New query)
-- =====================================================================

-- 1) Enum za ulogu (ako već postoji user_roles bez enuma, ostavi kako jest)
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'korisnik');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) user_roles (ako ne postoji)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'korisnik',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- 3) profiles.admin_user_id — veza korisnik → admin (tko ga je pozvao)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4) Tablica pozivnica
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'korisnik',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON public.invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);

-- 5) Tablica tab_permissions
CREATE TABLE IF NOT EXISTS public.tab_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tab_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tab_key)
);

CREATE INDEX IF NOT EXISTS idx_tab_permissions_user ON public.tab_permissions(user_id);

-- Trigger za updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_tab_permissions_updated_at ON public.tab_permissions;
CREATE TRIGGER tr_tab_permissions_updated_at
  BEFORE UPDATE ON public.tab_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Helper: je li user admin
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role = 'admin');
$$;

-- 7) Helper: vrati admin_user_id nekog usera (za pozivnicu = invited_by, za admina = self)
CREATE OR REPLACE FUNCTION public.get_org_admin(uid uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT admin_user_id FROM public.profiles WHERE user_id = uid),
    uid
  );
$$;

-- =====================================================================
-- RLS POLICIES
-- =====================================================================
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tab_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- --- invitations -----------------------------------------------------
DROP POLICY IF EXISTS "invitations_select_own" ON public.invitations;
CREATE POLICY "invitations_select_own" ON public.invitations
  FOR SELECT USING (invited_by = auth.uid());

DROP POLICY IF EXISTS "invitations_insert_admin" ON public.invitations;
CREATE POLICY "invitations_insert_admin" ON public.invitations
  FOR INSERT WITH CHECK (invited_by = auth.uid() AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "invitations_update_admin" ON public.invitations;
CREATE POLICY "invitations_update_admin" ON public.invitations
  FOR UPDATE USING (invited_by = auth.uid());

DROP POLICY IF EXISTS "invitations_delete_admin" ON public.invitations;
CREATE POLICY "invitations_delete_admin" ON public.invitations
  FOR DELETE USING (invited_by = auth.uid());

-- --- tab_permissions --------------------------------------------------
DROP POLICY IF EXISTS "perms_select_own_or_admin" ON public.tab_permissions;
CREATE POLICY "perms_select_own_or_admin" ON public.tab_permissions
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.get_org_admin(user_id) = auth.uid()
  );

DROP POLICY IF EXISTS "perms_write_admin" ON public.tab_permissions;
CREATE POLICY "perms_write_admin" ON public.tab_permissions
  FOR ALL USING (
    public.get_org_admin(user_id) = auth.uid() AND public.is_admin(auth.uid())
  ) WITH CHECK (
    public.get_org_admin(user_id) = auth.uid() AND public.is_admin(auth.uid())
  );

-- --- user_roles -------------------------------------------------------
DROP POLICY IF EXISTS "roles_select_self_or_admin" ON public.user_roles;
CREATE POLICY "roles_select_self_or_admin" ON public.user_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.get_org_admin(user_id) = auth.uid()
  );

DROP POLICY IF EXISTS "roles_admin_write" ON public.user_roles;
CREATE POLICY "roles_admin_write" ON public.user_roles
  FOR ALL USING (
    public.get_org_admin(user_id) = auth.uid() AND public.is_admin(auth.uid())
  ) WITH CHECK (
    public.get_org_admin(user_id) = auth.uid() AND public.is_admin(auth.uid())
  );

-- =====================================================================
-- FUNKCIJA: prihvat pozivnice (pozvati iz signup flow-a)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv record;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO inv FROM public.invitations
   WHERE token = p_token AND status = 'pending'
   LIMIT 1;

  IF inv.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;

  IF inv.expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  -- Postavi profil: poveži s adminom
  UPDATE public.profiles SET admin_user_id = inv.invited_by WHERE user_id = uid;

  -- Postavi ulogu
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, inv.role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Označi prihvaćeno
  UPDATE public.invitations
     SET status = 'accepted', accepted_by = uid, accepted_at = now()
   WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'admin_user_id', inv.invited_by, 'role', inv.role);
END $$;

-- =====================================================================
-- (opcionalno) Napravi trenutnog prvog usera adminom
-- Odkomentiraj ako ti treba inicijalno:
-- INSERT INTO public.user_roles (user_id, role)
--   SELECT id, 'admin' FROM auth.users ORDER BY created_at LIMIT 1
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
