ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS lead_city text;