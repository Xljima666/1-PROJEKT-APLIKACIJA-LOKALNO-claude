
-- Drop existing SELECT policies and replace with tab-permission-aware ones

-- ============ WORK_ORDERS ============
DROP POLICY IF EXISTS "Users can view own work orders or admin" ON public.work_orders;
CREATE POLICY "Users can view work orders with firma permission"
  ON public.work_orders FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR has_tab_permission(auth.uid(), 'firma'::text));

DROP POLICY IF EXISTS "Users can insert own work orders or admin" ON public.work_orders;
CREATE POLICY "Users can insert work orders with firma permission"
  ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text));

DROP POLICY IF EXISTS "Users can update own work orders or admin" ON public.work_orders;
CREATE POLICY "Users can update work orders with firma permission"
  ON public.work_orders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR has_tab_permission(auth.uid(), 'firma'::text))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR has_tab_permission(auth.uid(), 'firma'::text));

DROP POLICY IF EXISTS "Users can delete own work orders or admin" ON public.work_orders;
CREATE POLICY "Users can delete work orders with firma permission"
  ON public.work_orders FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR has_tab_permission(auth.uid(), 'firma'::text));

-- ============ WORK_ORDER_ITEMS ============
DROP POLICY IF EXISTS "Users can view own work order items or admin" ON public.work_order_items;
CREATE POLICY "Users can view work order items with firma permission"
  ON public.work_order_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM work_orders w WHERE w.id = work_order_items.work_order_id AND w.created_by = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own work order items or admin" ON public.work_order_items;
CREATE POLICY "Users can insert work order items with firma permission"
  ON public.work_order_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM work_orders w WHERE w.id = work_order_items.work_order_id AND w.created_by = auth.uid()));

DROP POLICY IF EXISTS "Users can update own work order items or admin" ON public.work_order_items;
CREATE POLICY "Users can update work order items with firma permission"
  ON public.work_order_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM work_orders w WHERE w.id = work_order_items.work_order_id AND w.created_by = auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM work_orders w WHERE w.id = work_order_items.work_order_id AND w.created_by = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own work order items or admin" ON public.work_order_items;
CREATE POLICY "Users can delete work order items with firma permission"
  ON public.work_order_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM work_orders w WHERE w.id = work_order_items.work_order_id AND w.created_by = auth.uid()));

-- ============ QUOTES ============
DROP POLICY IF EXISTS "Users can view own quotes or admin" ON public.quotes;
CREATE POLICY "Users can view quotes with firma permission"
  ON public.quotes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR has_tab_permission(auth.uid(), 'firma'::text));

DROP POLICY IF EXISTS "Users can insert own quotes or admin" ON public.quotes;
CREATE POLICY "Users can insert quotes with firma permission"
  ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text));

DROP POLICY IF EXISTS "Users can update own quotes or admin" ON public.quotes;
CREATE POLICY "Users can update quotes with firma permission"
  ON public.quotes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR has_tab_permission(auth.uid(), 'firma'::text))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR has_tab_permission(auth.uid(), 'firma'::text));

DROP POLICY IF EXISTS "Users can delete own quotes or admin" ON public.quotes;
CREATE POLICY "Users can delete quotes with firma permission"
  ON public.quotes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR has_tab_permission(auth.uid(), 'firma'::text));

-- ============ QUOTE_ITEMS ============
DROP POLICY IF EXISTS "Users can view own quote items or admin" ON public.quote_items;
CREATE POLICY "Users can view quote items with firma permission"
  ON public.quote_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_items.quote_id AND q.created_by = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own quote items or admin" ON public.quote_items;
CREATE POLICY "Users can insert quote items with firma permission"
  ON public.quote_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_items.quote_id AND q.created_by = auth.uid()));

DROP POLICY IF EXISTS "Users can update own quote items or admin" ON public.quote_items;
CREATE POLICY "Users can update quote items with firma permission"
  ON public.quote_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_items.quote_id AND q.created_by = auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_items.quote_id AND q.created_by = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own quote items or admin" ON public.quote_items;
CREATE POLICY "Users can delete quote items with firma permission"
  ON public.quote_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_items.quote_id AND q.created_by = auth.uid()));

-- ============ INVOICES ============
DROP POLICY IF EXISTS "Admins can create invoices" ON public.invoices;
CREATE POLICY "Users can insert invoices with firma permission"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text));

DROP POLICY IF EXISTS "Users can view own invoices or admin" ON public.invoices;
CREATE POLICY "Users can view invoices with firma permission"
  ON public.invoices FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR has_tab_permission(auth.uid(), 'firma'::text));

DROP POLICY IF EXISTS "Admins can update invoices" ON public.invoices;
CREATE POLICY "Users can update invoices with firma permission"
  ON public.invoices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR has_tab_permission(auth.uid(), 'firma'::text))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR has_tab_permission(auth.uid(), 'firma'::text));

DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;
CREATE POLICY "Users can delete invoices with firma permission"
  ON public.invoices FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()) OR has_tab_permission(auth.uid(), 'firma'::text));

-- ============ INVOICE_ITEMS ============
DROP POLICY IF EXISTS "Admins can create invoice_items" ON public.invoice_items;
CREATE POLICY "Users can insert invoice items with firma permission"
  ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND i.created_by = auth.uid()));

DROP POLICY IF EXISTS "Users can view own invoice_items or admin" ON public.invoice_items;
CREATE POLICY "Users can view invoice items with firma permission"
  ON public.invoice_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND i.created_by = auth.uid()));

DROP POLICY IF EXISTS "Admins can update invoice_items" ON public.invoice_items;
CREATE POLICY "Users can update invoice items with firma permission"
  ON public.invoice_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND i.created_by = auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND i.created_by = auth.uid()));

DROP POLICY IF EXISTS "Admins can delete invoice_items" ON public.invoice_items;
CREATE POLICY "Users can delete invoice items with firma permission"
  ON public.invoice_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_tab_permission(auth.uid(), 'firma'::text) OR EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND i.created_by = auth.uid()));
