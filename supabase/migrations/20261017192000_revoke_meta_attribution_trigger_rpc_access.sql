-- Attribution propagation runs only from table triggers. Do not expose the
-- SECURITY DEFINER helper as a callable Data API/RPC function.
REVOKE ALL ON FUNCTION public.copy_meta_lead_attribution_to_rd_deal() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.copy_meta_lead_attribution_to_rd_deal() FROM anon;
REVOKE ALL ON FUNCTION public.copy_meta_lead_attribution_to_rd_deal() FROM authenticated;
