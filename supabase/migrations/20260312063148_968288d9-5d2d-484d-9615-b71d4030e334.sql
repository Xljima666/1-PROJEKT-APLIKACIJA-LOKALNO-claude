
-- FIX ERROR: workspace_items SELECT - remove cross-user private notes exposure
DROP POLICY IF EXISTS "Users can view workspace items" ON public.workspace_items;
CREATE POLICY "Users can view workspace items" ON public.workspace_items
  FOR SELECT TO authenticated
  USING (
    (is_private = false)
    OR (user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- FIX ERROR: archived_boards SELECT - change from public to authenticated
DROP POLICY IF EXISTS "Authenticated users can view archived_boards" ON public.archived_boards;
CREATE POLICY "Authenticated users can view archived_boards" ON public.archived_boards
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can create archived_boards" ON public.archived_boards;
CREATE POLICY "Admins can create archived_boards" ON public.archived_boards
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete archived_boards" ON public.archived_boards;
CREATE POLICY "Admins can delete archived_boards" ON public.archived_boards
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- FIX ERROR: archived_columns SELECT - change from public to authenticated
DROP POLICY IF EXISTS "Authenticated users can view archived_columns" ON public.archived_columns;
CREATE POLICY "Authenticated users can view archived_columns" ON public.archived_columns
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create archived_columns" ON public.archived_columns;
CREATE POLICY "Admins can create archived_columns" ON public.archived_columns
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- FIX WARN: columns - restrict to admin
DROP POLICY IF EXISTS "Authenticated users can update columns" ON public.columns;
CREATE POLICY "Admins can update columns" ON public.columns
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can delete columns" ON public.columns;
CREATE POLICY "Admins can delete columns" ON public.columns
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can create columns" ON public.columns;
CREATE POLICY "Admins can create columns" ON public.columns
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- FIX WARN: attachments - restrict INSERT/DELETE
DROP POLICY IF EXISTS "Authenticated users can create attachments" ON public.attachments;
CREATE POLICY "Users can create attachments" ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON public.attachments;
CREATE POLICY "Users can delete own attachments or admin" ON public.attachments
  FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role));

-- FIX WARN: labels - restrict to admin
DROP POLICY IF EXISTS "Authenticated users can create labels" ON public.labels;
CREATE POLICY "Admins can create labels" ON public.labels
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can update labels" ON public.labels;
CREATE POLICY "Admins can update labels" ON public.labels
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can delete labels" ON public.labels;
CREATE POLICY "Admins can delete labels" ON public.labels
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- FIX WARN: card_labels - restrict to admin
DROP POLICY IF EXISTS "Authenticated users can create card_labels" ON public.card_labels;
CREATE POLICY "Admins can create card_labels" ON public.card_labels
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can delete card_labels" ON public.card_labels;
CREATE POLICY "Admins can delete card_labels" ON public.card_labels
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- FIX WARN: activity_log - restrict
DROP POLICY IF EXISTS "Authenticated users can create activity_log" ON public.activity_log;
CREATE POLICY "Users can create own activity_log" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view activity_log" ON public.activity_log;
CREATE POLICY "Users can view own or admin all activity_log" ON public.activity_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_id = auth.uid());
