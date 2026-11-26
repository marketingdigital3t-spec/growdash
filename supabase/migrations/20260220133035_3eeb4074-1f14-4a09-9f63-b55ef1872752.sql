-- Add unique constraint on insights for upsert
ALTER TABLE public.insights ADD CONSTRAINT insights_ad_id_date_unique UNIQUE (ad_id, date);
