-- Pixels/datasets per ad account
CREATE TABLE public.ad_account_pixel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  pixel_id text NOT NULL,
  name text NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, pixel_id)
);

ALTER TABLE public.ad_account_pixel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View ad_account_pixel" ON public.ad_account_pixel
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert ad_account_pixel" ON public.ad_account_pixel
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Update ad_account_pixel" ON public.ad_account_pixel
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete ad_account_pixel" ON public.ad_account_pixel
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

-- Events available on each pixel
CREATE TABLE public.pixel_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pixel_id uuid NOT NULL REFERENCES public.ad_account_pixel(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  action_type text NOT NULL,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pixel_id, action_type)
);

ALTER TABLE public.pixel_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pixel_event" ON public.pixel_event
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.ad_account_pixel p
      WHERE p.id = pixel_event.pixel_id AND user_owns_ad_account(auth.uid(), p.ad_account_id)
    )
  );
CREATE POLICY "Insert pixel_event" ON public.pixel_event
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.ad_account_pixel p
      WHERE p.id = pixel_event.pixel_id AND user_owns_ad_account(auth.uid(), p.ad_account_id)
    )
  );
CREATE POLICY "Update pixel_event" ON public.pixel_event
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.ad_account_pixel p
      WHERE p.id = pixel_event.pixel_id AND user_owns_ad_account(auth.uid(), p.ad_account_id)
    )
  );
CREATE POLICY "Delete pixel_event" ON public.pixel_event
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.ad_account_pixel p
      WHERE p.id = pixel_event.pixel_id AND user_owns_ad_account(auth.uid(), p.ad_account_id)
    )
  );

-- Per-account Landing Page configuration
CREATE TABLE public.account_lp_config (
  ad_account_id uuid PRIMARY KEY REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  pixel_id uuid REFERENCES public.ad_account_pixel(id) ON DELETE SET NULL,
  action_type text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_lp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View account_lp_config" ON public.account_lp_config
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert account_lp_config" ON public.account_lp_config
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Update account_lp_config" ON public.account_lp_config
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete account_lp_config" ON public.account_lp_config
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

-- Migrate existing landing_page configs (one per account, prefer first)
INSERT INTO public.account_lp_config (ad_account_id, action_type)
SELECT DISTINCT ON (ad_account_id) ad_account_id, lp_lead_action
FROM public.account_lead_action
WHERE scope = 'landing_page'
ORDER BY ad_account_id, updated_at DESC
ON CONFLICT (ad_account_id) DO NOTHING;