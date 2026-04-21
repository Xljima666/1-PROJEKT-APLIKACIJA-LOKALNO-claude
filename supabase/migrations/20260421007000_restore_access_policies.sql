-- Emergency restore for app access.
-- Keep the legacy permission model working as the primary compatibility layer.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role::text
  )
  OR (
    _role = 'admin'::app_role
    AND EXISTS (
      SELECT 1
      FROM auth.users
      WHERE id = _user_id
        AND lower(email) IN ('markopetronijevic666@gmail.com')
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(uid, 'admin'::app_role);
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
  SELECT public.has_role(_user_id, 'admin'::app_role)
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

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE lower(email) IN ('markopetronijevic666@gmail.com')
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = auth.users.id
      AND user_roles.role::text = 'admin'
  );

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tab_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tab_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can view roles" ON public.user_roles;
CREATE POLICY "Users can view roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can view own permissions or admin all" ON public.user_tab_permissions;
DROP POLICY IF EXISTS "Anyone can view tab permissions" ON public.user_tab_permissions;
CREATE POLICY "Anyone can view tab permissions" ON public.user_tab_permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "restore_admin_manage_legacy_permissions" ON public.user_tab_permissions;
CREATE POLICY "restore_admin_manage_legacy_permissions" ON public.user_tab_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "restore_view_tab_permissions" ON public.tab_permissions;
CREATE POLICY "restore_view_tab_permissions" ON public.tab_permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "restore_admin_manage_tab_permissions" ON public.tab_permissions;
CREATE POLICY "restore_admin_manage_tab_permissions" ON public.tab_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view workspace items" ON public.workspace_items;
CREATE POLICY "Users can view workspace items" ON public.workspace_items
  FOR SELECT TO authenticated
  USING (
    is_private = false
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_tab_permission(auth.uid(), 'privatne-biljeske-sve')
  );

DROP POLICY IF EXISTS "restore_google_tokens_own_or_admin" ON public.google_tokens;
CREATE POLICY "restore_google_tokens_own_or_admin" ON public.google_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "restore_invitations_admin_manage_all" ON public.invitations;
CREATE POLICY "restore_invitations_admin_manage_all" ON public.invitations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
