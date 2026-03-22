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
$$;

DROP POLICY IF EXISTS "Users can view related cards or admin all" ON public.cards;
CREATE POLICY "Users with poslovi permission can view cards"
  ON public.cards FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_tab_permission(auth.uid(), 'poslovi')
  );

DROP POLICY IF EXISTS "Users can update related cards or admin" ON public.cards;
CREATE POLICY "Users with poslovi permission can update cards"
  ON public.cards FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_tab_permission(auth.uid(), 'poslovi')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_tab_permission(auth.uid(), 'poslovi')
  );

DROP TRIGGER IF EXISTS prevent_cards_created_by_hijack ON public.cards;
CREATE TRIGGER prevent_cards_created_by_hijack
BEFORE UPDATE ON public.cards
FOR EACH ROW
EXECUTE FUNCTION public.prevent_created_by_hijack();

DROP POLICY IF EXISTS "Users can view comments for accessible cards" ON public.comments;
CREATE POLICY "Users with poslovi permission can view comments"
  ON public.comments FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_tab_permission(auth.uid(), 'poslovi')
  );

DROP POLICY IF EXISTS "Users can view attachments for accessible cards" ON public.attachments;
CREATE POLICY "Users with poslovi permission can view attachments"
  ON public.attachments FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_tab_permission(auth.uid(), 'poslovi')
  );