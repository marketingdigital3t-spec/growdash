
-- Tabela de mapeamento de UTMs por conta de anúncios
CREATE TABLE IF NOT EXISTS public.account_utm_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL UNIQUE,
  campaign_utm text NOT NULL DEFAULT 'utm_campaign',
  adset_utm text NOT NULL DEFAULT 'utm_term',
  creative_utm text NOT NULL DEFAULT 'utm_content',
  platform_utm text NOT NULL DEFAULT 'utm_source',
  match_strategy text NOT NULL DEFAULT 'normalized',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_utm_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View account_utm_mapping" ON public.account_utm_mapping
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert account_utm_mapping" ON public.account_utm_mapping
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Update account_utm_mapping" ON public.account_utm_mapping
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete account_utm_mapping" ON public.account_utm_mapping
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE TRIGGER update_account_utm_mapping_updated_at
  BEFORE UPDATE ON public.account_utm_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Override manual de atribuição na venda
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS manual_campaign_id text,
  ADD COLUMN IF NOT EXISTS manual_adset_id text,
  ADD COLUMN IF NOT EXISTS manual_ad_id text,
  ADD COLUMN IF NOT EXISTS manual_override boolean NOT NULL DEFAULT false;

-- Popular defaults para contas existentes
INSERT INTO public.account_utm_mapping (ad_account_id)
SELECT id FROM public.ad_accounts
ON CONFLICT (ad_account_id) DO NOTHING;
