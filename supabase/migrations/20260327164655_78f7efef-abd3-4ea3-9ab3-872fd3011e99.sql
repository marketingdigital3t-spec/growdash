ALTER TABLE public.funnels
  ADD COLUMN ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  ADD COLUMN campaign_ids text[] DEFAULT '{}',
  ADD COLUMN funnel_type text NOT NULL DEFAULT 'blank';