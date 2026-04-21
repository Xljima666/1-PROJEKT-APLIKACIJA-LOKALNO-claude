-- =====================================================================
-- HOTFIX 2: popuni full_name u profiles iz auth.users metadata
-- i postavi Marku Petronijeviću ime ako fali
-- =====================================================================

-- 1) Pokupi full_name iz user_metadata za sve profile kojima fali
UPDATE public.profiles p
   SET full_name = COALESCE(
     NULLIF(p.full_name, ''),
     u.raw_user_meta_data ->> 'full_name',
     u.raw_user_meta_data ->> 'name',
     split_part(u.email, '@', 1)
   )
  FROM auth.users u
 WHERE p.user_id = u.id
   AND (p.full_name IS NULL OR p.full_name = '');

-- 2) Specifično za Marka — ako je i dalje prazno, postavi "Marko Petronijević"
UPDATE public.profiles p
   SET full_name = 'Marko Petronijević'
  FROM auth.users u
 WHERE p.user_id = u.id
   AND lower(u.email) = 'markopetronijevic666@gmail.com'
   AND (p.full_name IS NULL OR p.full_name = '');

-- 3) Provjera
SELECT u.email, p.full_name, r.role
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.user_roles r ON r.user_id = u.id
 WHERE lower(u.email) = 'markopetronijevic666@gmail.com';
