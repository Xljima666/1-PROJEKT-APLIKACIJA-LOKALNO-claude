
CREATE TABLE public.user_tab_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tab_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, tab_key)
);

ALTER TABLE public.user_tab_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tab permissions"
  ON public.user_tab_permissions FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert tab permissions"
  ON public.user_tab_permissions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update tab permissions"
  ON public.user_tab_permissions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete tab permissions"
  ON public.user_tab_permissions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
