
-- Create quotes (ponude) table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_type TEXT NOT NULL DEFAULT 'B2C',
  address TEXT,
  oib TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quotes" ON public.quotes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert quotes" ON public.quotes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update quotes" ON public.quotes FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete quotes" ON public.quotes FOR DELETE USING (auth.uid() IS NOT NULL);

-- Quote items
CREATE TABLE public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'kom',
  quantity NUMERIC NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 25,
  total NUMERIC NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quote items" ON public.quote_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert quote items" ON public.quote_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update quote items" ON public.quote_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete quote items" ON public.quote_items FOR DELETE USING (auth.uid() IS NOT NULL);
