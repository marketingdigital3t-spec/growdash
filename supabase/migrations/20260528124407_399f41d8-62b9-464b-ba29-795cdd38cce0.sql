ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS payment_method_source text NOT NULL DEFAULT 'default';