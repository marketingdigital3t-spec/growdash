
ALTER TABLE public.sales ADD CONSTRAINT sales_rd_deal_id_unique UNIQUE (rd_deal_id);
CREATE INDEX IF NOT EXISTS idx_sales_email_date ON public.sales (contact_email, sale_date) WHERE contact_email IS NOT NULL;
