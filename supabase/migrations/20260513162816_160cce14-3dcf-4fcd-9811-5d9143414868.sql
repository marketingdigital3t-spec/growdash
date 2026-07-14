ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS lead_entry_date DATE;