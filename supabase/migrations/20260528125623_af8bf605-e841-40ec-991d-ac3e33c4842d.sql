
CREATE TABLE public.rd_field_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  rd_source text NOT NULL DEFAULT 'deal',
  rd_field_label text NOT NULL,
  rd_field_aliases text[] NOT NULL DEFAULT '{}',
  field_type text NOT NULL DEFAULT 'enum',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  show_in_dashboard boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rd_field_configs TO authenticated;
GRANT ALL ON public.rd_field_configs TO service_role;

ALTER TABLE public.rd_field_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View rd_field_configs"
  ON public.rd_field_configs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Insert rd_field_configs"
  ON public.rd_field_configs FOR INSERT
  WITH CHECK ((auth.uid() = user_id) AND (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id)));

CREATE POLICY "Update rd_field_configs"
  ON public.rd_field_configs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Delete rd_field_configs"
  ON public.rd_field_configs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE TRIGGER update_rd_field_configs_updated_at
  BEFORE UPDATE ON public.rd_field_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.rd_deals ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.sales    ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_rd_deals_custom_fields ON public.rd_deals USING gin (custom_fields);
CREATE INDEX IF NOT EXISTS idx_sales_custom_fields ON public.sales USING gin (custom_fields);
