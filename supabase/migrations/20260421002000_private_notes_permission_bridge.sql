-- Keep private-note RLS compatible with both permission systems.
-- Older workspace code uses user_tab_permissions with dash keys.
-- Team management uses tab_permissions with underscore keys and enabled flags.

CREATE OR REPLACE FUNCTION public.has_tab_permission(_user_id uuid, _tab_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tab_permissions
    WHERE user_id = _user_id
      AND tab_key = _tab_key
  )
  OR EXISTS (
    SELECT 1
    FROM public.tab_permissions
    WHERE user_id = _user_id
      AND enabled = true
      AND tab_key = CASE _tab_key
        WHEN 'privatne-biljeske' THEN 'privatne_biljeske'
        WHEN 'privatne-biljeske-sve' THEN 'sve_privatne_biljeske'
        WHEN 'kontakt-upiti' THEN 'kontakt_upiti'
        ELSE _tab_key
      END
  )
$$;

WITH mapped_permissions AS (
  SELECT DISTINCT
    user_id,
    CASE tab_key
      WHEN 'privatne_biljeske' THEN 'privatne-biljeske'
      WHEN 'sve_privatne_biljeske' THEN 'privatne-biljeske-sve'
      WHEN 'kontakt_upiti' THEN 'kontakt-upiti'
      ELSE tab_key
    END AS tab_key
  FROM public.tab_permissions
  WHERE enabled = true
    AND tab_key IN ('privatne_biljeske', 'sve_privatne_biljeske', 'kontakt_upiti')
)
INSERT INTO public.user_tab_permissions (user_id, tab_key)
SELECT mp.user_id, mp.tab_key
FROM mapped_permissions mp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_tab_permissions existing
  WHERE existing.user_id = mp.user_id
    AND existing.tab_key = mp.tab_key
);
