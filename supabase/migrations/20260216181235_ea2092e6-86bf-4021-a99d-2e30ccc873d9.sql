
-- Add new columns to work_orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'B2C',
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS oib text,
  ADD COLUMN IF NOT EXISTS worker_name text,
  ADD COLUMN IF NOT EXISTS fault_description text,
  ADD COLUMN IF NOT EXISTS work_description text,
  ADD COLUMN IF NOT EXISTS hide_amounts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric NOT NULL DEFAULT 0;

-- Create work_order_items table
CREATE TABLE public.work_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'kom',
  quantity numeric NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 25,
  total numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view work order items"
  ON public.work_order_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert work order items"
  ON public.work_order_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update work order items"
  ON public.work_order_items FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete work order items"
  ON public.work_order_items FOR DELETE
  USING (auth.uid() IS NOT NULL);
