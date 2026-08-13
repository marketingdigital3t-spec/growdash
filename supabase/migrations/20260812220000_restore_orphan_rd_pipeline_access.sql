-- RD negotiations must remain visible when an old Meta ad-account record was
-- removed. Access is based on the RD funnel owner or an explicit funnel grant,
-- never on a deleted advertising-account row.

DROP POLICY IF EXISTS "Owners view RD funnels with removed accounts" ON public.rd_funnels;
CREATE POLICY "Owners view RD funnels with removed accounts"
ON public.rd_funnels FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_rd_funnel_access access
    WHERE access.user_id = auth.uid() AND access.rd_funnel_id = rd_funnels.id
  )
);

DROP POLICY IF EXISTS "Owners view RD deals with removed accounts" ON public.rd_deals;
CREATE POLICY "Owners view RD deals with removed accounts"
ON public.rd_deals FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rd_funnels funnel
    WHERE funnel.id = rd_deals.rd_funnel_id
      AND (
        funnel.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_rd_funnel_access access
          WHERE access.user_id = auth.uid() AND access.rd_funnel_id = funnel.id
        )
      )
  )
);

DROP POLICY IF EXISTS "Owners view RD stages with removed accounts" ON public.rd_funnel_stages;
CREATE POLICY "Owners view RD stages with removed accounts"
ON public.rd_funnel_stages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rd_funnels funnel
    WHERE funnel.id = rd_funnel_stages.rd_funnel_id
      AND (
        funnel.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_rd_funnel_access access
          WHERE access.user_id = auth.uid() AND access.rd_funnel_id = funnel.id
        )
      )
  )
);
