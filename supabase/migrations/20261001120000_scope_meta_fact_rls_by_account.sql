-- Meta facts carry the internal ad_accounts.id so the analytics reader does
-- not depend on a complete ads -> adsets -> campaigns catalog. Keep the
-- catalog policies for legacy rows, but authorize scoped facts directly by
-- their account when that column is populated.

DROP POLICY IF EXISTS "Users can view own insights" ON public.insights;
CREATE POLICY "Users can view own insights" ON public.insights FOR SELECT USING (
  public.has_role(auth.uid(), 'admin')
  OR (ad_account_id IS NOT NULL AND public.user_can_view_ad_account(auth.uid(), ad_account_id))
  OR (ad_account_id IS NULL AND public.user_can_access_ad(auth.uid(), ad_id))
);

DROP POLICY IF EXISTS "Users can insert insights" ON public.insights;
CREATE POLICY "Users can insert insights" ON public.insights FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (ad_account_id IS NOT NULL AND public.user_can_view_ad_account(auth.uid(), ad_account_id))
  OR (ad_account_id IS NULL AND public.user_can_access_ad(auth.uid(), ad_id))
);

DROP POLICY IF EXISTS "View insight_actions" ON public.insight_actions;
CREATE POLICY "View insight_actions" ON public.insight_actions FOR SELECT USING (
  public.has_role(auth.uid(), 'admin')
  OR (ad_account_id IS NOT NULL AND public.user_can_view_ad_account(auth.uid(), ad_account_id))
  OR (ad_account_id IS NULL AND public.user_can_access_ad(auth.uid(), ad_id))
);

DROP POLICY IF EXISTS "Insert insight_actions" ON public.insight_actions;
CREATE POLICY "Insert insight_actions" ON public.insight_actions FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (ad_account_id IS NOT NULL AND public.user_can_view_ad_account(auth.uid(), ad_account_id))
  OR (ad_account_id IS NULL AND public.user_can_access_ad(auth.uid(), ad_id))
);

DROP POLICY IF EXISTS "Update insight_actions" ON public.insight_actions;
CREATE POLICY "Update insight_actions" ON public.insight_actions FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin')
  OR (ad_account_id IS NOT NULL AND public.user_can_view_ad_account(auth.uid(), ad_account_id))
  OR (ad_account_id IS NULL AND public.user_can_access_ad(auth.uid(), ad_id))
);

DROP POLICY IF EXISTS "Delete insight_actions" ON public.insight_actions;
CREATE POLICY "Delete insight_actions" ON public.insight_actions FOR DELETE USING (
  public.has_role(auth.uid(), 'admin')
  OR (ad_account_id IS NOT NULL AND public.user_can_view_ad_account(auth.uid(), ad_account_id))
  OR (ad_account_id IS NULL AND public.user_can_access_ad(auth.uid(), ad_id))
);
