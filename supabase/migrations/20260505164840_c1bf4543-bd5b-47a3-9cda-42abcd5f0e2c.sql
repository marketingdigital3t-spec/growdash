ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.adsets ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS status text;