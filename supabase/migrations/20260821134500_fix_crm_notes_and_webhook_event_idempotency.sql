-- Shared CRM users already pass the ad-account RLS used to read the deal.
-- Notes must follow that same boundary instead of requiring personal ownership.
DROP POLICY IF EXISTS "View RD deal notes" ON public.rd_deal_notes;
CREATE POLICY "View RD deal notes"
  ON public.rd_deal_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.rd_deals deal
      WHERE deal.id = rd_deal_notes.rd_deal_id
        AND public.user_can_view_ad_account(auth.uid(), deal.ad_account_id)
    )
  );

DROP POLICY IF EXISTS "Create own RD deal notes" ON public.rd_deal_notes;
CREATE POLICY "Create own RD deal notes"
  ON public.rd_deal_notes FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.rd_deals deal
      WHERE deal.id = rd_deal_notes.rd_deal_id
        AND public.user_can_view_ad_account(auth.uid(), deal.ad_account_id)
    )
  );

-- provider_event_id is commonly the order/transaction identifier. It is not
-- unique across lifecycle events such as approved, refunded and chargeback.
ALTER TABLE public.sales_webhook_events
  DROP CONSTRAINT IF EXISTS sales_webhook_events_integration_id_provider_event_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS sales_webhook_events_integration_payload_unique_idx
  ON public.sales_webhook_events (integration_id, payload_sha256);
