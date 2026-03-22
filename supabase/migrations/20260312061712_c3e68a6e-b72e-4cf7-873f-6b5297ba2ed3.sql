-- Tighten archived_cards policies (remove anonymous/public access)
DROP POLICY IF EXISTS "Admins can delete archived_cards" ON public.archived_cards;
DROP POLICY IF EXISTS "Authenticated users can create archived_cards" ON public.archived_cards;
DROP POLICY IF EXISTS "Authenticated users can delete archived_cards" ON public.archived_cards;
DROP POLICY IF EXISTS "Authenticated users can view archived_cards" ON public.archived_cards;

CREATE POLICY "Admins can delete archived_cards"
ON public.archived_cards
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can create archived_cards"
ON public.archived_cards
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND archived_by = auth.uid());

CREATE POLICY "Authenticated users can view archived_cards"
ON public.archived_cards
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Tighten workspace_items UPDATE to owner-only
DROP POLICY IF EXISTS "Users can update workspace items" ON public.workspace_items;

CREATE POLICY "Users can update workspace items"
ON public.workspace_items
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tighten cards policies for sensitive PII fields
DROP POLICY IF EXISTS "Authenticated users can create cards" ON public.cards;
DROP POLICY IF EXISTS "Authenticated users can delete cards" ON public.cards;
DROP POLICY IF EXISTS "Authenticated users can update cards" ON public.cards;
DROP POLICY IF EXISTS "Authenticated users can view cards" ON public.cards;

CREATE POLICY "Users can view related cards or admin all"
ON public.cards
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR assigned_to = auth.uid()
);

CREATE POLICY "Users can insert own cards or admin"
ON public.cards
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
);

CREATE POLICY "Users can update related cards or admin"
ON public.cards
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR assigned_to = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR assigned_to = auth.uid()
);

CREATE POLICY "Users can delete related cards or admin"
ON public.cards
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR assigned_to = auth.uid()
);