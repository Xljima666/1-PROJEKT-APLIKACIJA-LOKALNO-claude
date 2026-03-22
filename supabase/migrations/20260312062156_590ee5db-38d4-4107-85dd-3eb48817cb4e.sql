-- Fix sensitive data exposure on invoices
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;

CREATE POLICY "Users can view own invoices or admin"
ON public.invoices
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "Authenticated users can view invoice_items" ON public.invoice_items;

CREATE POLICY "Users can view own invoice_items or admin"
ON public.invoice_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR i.created_by = auth.uid()
      )
  )
);

-- Fix sensitive data exposure on quotes
DROP POLICY IF EXISTS "Authenticated users can view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can delete quotes" ON public.quotes;

CREATE POLICY "Users can view own quotes or admin"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
);

CREATE POLICY "Users can insert own quotes or admin"
ON public.quotes
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
);

CREATE POLICY "Users can update own quotes or admin"
ON public.quotes
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
);

CREATE POLICY "Users can delete own quotes or admin"
ON public.quotes
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "Authenticated users can view quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Authenticated users can insert quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Authenticated users can update quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Authenticated users can delete quote items" ON public.quote_items;

CREATE POLICY "Users can view own quote items or admin"
ON public.quote_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR q.created_by = auth.uid()
      )
  )
);

CREATE POLICY "Users can insert own quote items or admin"
ON public.quote_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR q.created_by = auth.uid()
      )
  )
);

CREATE POLICY "Users can update own quote items or admin"
ON public.quote_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR q.created_by = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR q.created_by = auth.uid()
      )
  )
);

CREATE POLICY "Users can delete own quote items or admin"
ON public.quote_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR q.created_by = auth.uid()
      )
  )
);

-- Fix sensitive data exposure on work orders
DROP POLICY IF EXISTS "Authenticated users can view work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Authenticated users can insert work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Authenticated users can update work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Authenticated users can delete work orders" ON public.work_orders;

CREATE POLICY "Users can view own work orders or admin"
ON public.work_orders
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
);

CREATE POLICY "Users can insert own work orders or admin"
ON public.work_orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
);

CREATE POLICY "Users can update own work orders or admin"
ON public.work_orders
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
);

CREATE POLICY "Users can delete own work orders or admin"
ON public.work_orders
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "Authenticated users can view work order items" ON public.work_order_items;
DROP POLICY IF EXISTS "Authenticated users can insert work order items" ON public.work_order_items;
DROP POLICY IF EXISTS "Authenticated users can update work order items" ON public.work_order_items;
DROP POLICY IF EXISTS "Authenticated users can delete work order items" ON public.work_order_items;

CREATE POLICY "Users can view own work order items or admin"
ON public.work_order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.work_orders w
    WHERE w.id = work_order_items.work_order_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR w.created_by = auth.uid()
      )
  )
);

CREATE POLICY "Users can insert own work order items or admin"
ON public.work_order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.work_orders w
    WHERE w.id = work_order_items.work_order_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR w.created_by = auth.uid()
      )
  )
);

CREATE POLICY "Users can update own work order items or admin"
ON public.work_order_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.work_orders w
    WHERE w.id = work_order_items.work_order_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR w.created_by = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.work_orders w
    WHERE w.id = work_order_items.work_order_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR w.created_by = auth.uid()
      )
  )
);

CREATE POLICY "Users can delete own work order items or admin"
ON public.work_order_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.work_orders w
    WHERE w.id = work_order_items.work_order_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR w.created_by = auth.uid()
      )
  )
);

-- Remove anonymous insert on archived_columns
DROP POLICY IF EXISTS "Authenticated users can create archived_columns" ON public.archived_columns;

CREATE POLICY "Authenticated users can create archived_columns"
ON public.archived_columns
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);