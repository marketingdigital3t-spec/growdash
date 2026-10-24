-- These trigger-only routines must never be callable through PostgREST.
-- Revoke explicit role grants as well as the PUBLIC grant.
revoke execute on function public.link_rd_deal_to_meta_form_lead() from anon, authenticated;
revoke execute on function public.prevent_zero_value_rd_sale() from anon, authenticated;
revoke execute on function public.propagate_meta_form_attribution_to_sale() from anon, authenticated;
revoke execute on function public.reconcile_meta_form_lead_arrival() from anon, authenticated;
