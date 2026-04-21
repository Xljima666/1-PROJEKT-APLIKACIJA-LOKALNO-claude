-- Permission compatibility hotfix.
-- The app still has legacy screens that read user_tab_permissions with dash keys,
-- while the Team screen writes tab_permissions with underscore keys.

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = uid
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_tab_permission(_user_id uuid, _tab_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidate_keys AS (
    SELECT DISTINCT key
    FROM unnest(ARRAY[
      _tab_key,
      replace(_tab_key, '-', '_'),
      CASE _tab_key
        WHEN 'kontakt-upiti' THEN 'kontakt_upiti'
        WHEN 'kontakt_upiti' THEN 'kontakt-upiti'
        WHEN 'privatne-biljeske' THEN 'privatne_biljeske'
        WHEN 'privatne_biljeske' THEN 'privatne-biljeske'
        WHEN 'privatne-biljeske-sve' THEN 'sve_privatne_biljeske'
        WHEN 'sve_privatne_biljeske' THEN 'privatne-biljeske-sve'
        WHEN 'samo-stellan' THEN 'stellan_only'
        WHEN 'stellan_only' THEN 'samo-stellan'
        ELSE NULL
      END
    ]) AS key
    WHERE key IS NOT NULL
  )
  SELECT public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_tab_permissions legacy
      JOIN candidate_keys keys ON keys.key = legacy.tab_key
      WHERE legacy.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.tab_permissions current_perms
      JOIN candidate_keys keys ON keys.key = current_perms.tab_key
      WHERE current_perms.user_id = _user_id
        AND current_perms.enabled = true
    );
$$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tab_permissions
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.tab_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tab_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compat_user_roles_select_self_or_admin" ON public.user_roles;
CREATE POLICY "compat_user_roles_select_self_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "compat_user_roles_admin_manage" ON public.user_roles;
CREATE POLICY "compat_user_roles_admin_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "compat_tab_permissions_select_self_or_admin" ON public.tab_permissions;
CREATE POLICY "compat_tab_permissions_select_self_or_admin" ON public.tab_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "compat_tab_permissions_admin_manage" ON public.tab_permissions;
CREATE POLICY "compat_tab_permissions_admin_manage" ON public.tab_permissions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "compat_legacy_permissions_select_self_or_admin" ON public.user_tab_permissions;
CREATE POLICY "compat_legacy_permissions_select_self_or_admin" ON public.user_tab_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "compat_legacy_permissions_admin_manage" ON public.user_tab_permissions;
CREATE POLICY "compat_legacy_permissions_admin_manage" ON public.user_tab_permissions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "compat_invitations_admin_manage_all" ON public.invitations;
CREATE POLICY "compat_invitations_admin_manage_all" ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

WITH legacy_to_current AS (
  SELECT DISTINCT
    user_id,
    CASE tab_key
      WHEN 'kontakt-upiti' THEN 'kontakt_upiti'
      WHEN 'privatne-biljeske' THEN 'privatne_biljeske'
      WHEN 'privatne-biljeske-sve' THEN 'sve_privatne_biljeske'
      WHEN 'samo-stellan' THEN 'stellan_only'
      ELSE tab_key
    END AS tab_key
  FROM public.user_tab_permissions
  WHERE tab_key IN (
    'poslovi',
    'geodezija',
    'firma',
    'tim',
    'postavke',
    'kontakt-upiti',
    'privatne-biljeske',
    'privatne-biljeske-sve',
    'samo-stellan'
  )
)
INSERT INTO public.tab_permissions (user_id, tab_key, enabled)
SELECT legacy_to_current.user_id, legacy_to_current.tab_key, true
FROM legacy_to_current
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tab_permissions existing
  WHERE existing.user_id = legacy_to_current.user_id
    AND existing.tab_key = legacy_to_current.tab_key
);

WITH current_to_legacy AS (
  SELECT DISTINCT
    user_id,
    CASE tab_key
      WHEN 'kontakt_upiti' THEN 'kontakt-upiti'
      WHEN 'privatne_biljeske' THEN 'privatne-biljeske'
      WHEN 'sve_privatne_biljeske' THEN 'privatne-biljeske-sve'
      WHEN 'stellan_only' THEN 'samo-stellan'
      ELSE tab_key
    END AS tab_key
  FROM public.tab_permissions
  WHERE enabled = true
    AND tab_key IN (
      'poslovi',
      'geodezija',
      'firma',
      'tim',
      'postavke',
      'kontakt_upiti',
      'privatne_biljeske',
      'sve_privatne_biljeske',
      'stellan_only'
    )
)
INSERT INTO public.user_tab_permissions (user_id, tab_key)
SELECT current_to_legacy.user_id, current_to_legacy.tab_key
FROM current_to_legacy
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_tab_permissions existing
  WHERE existing.user_id = current_to_legacy.user_id
    AND existing.tab_key = current_to_legacy.tab_key
);
