
-- Company settings table for logo and company info
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT,
  logo_url TEXT,
  address TEXT,
  oib TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own company settings"
  ON public.company_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own company settings"
  ON public.company_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own company settings"
  ON public.company_settings FOR UPDATE USING (auth.uid() = user_id);

-- Storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true);

CREATE POLICY "Users can upload company logos"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their company logos"
  ON storage.objects FOR UPDATE USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Company logos are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'company-logos');

CREATE POLICY "Users can delete their company logos"
  ON storage.objects FOR DELETE USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
