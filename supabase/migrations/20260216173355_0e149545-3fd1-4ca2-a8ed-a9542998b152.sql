
CREATE TABLE public.work_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view work orders"
ON public.work_orders FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert work orders"
ON public.work_orders FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update work orders"
ON public.work_orders FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete work orders"
ON public.work_orders FOR DELETE
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_work_orders_updated_at
BEFORE UPDATE ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
