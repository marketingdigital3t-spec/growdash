-- Trigger-only functions are invoked by PostgreSQL triggers, never by the
-- client. Keep their execution surface private while preserving trigger
-- execution under the function owner.
revoke all on function public.link_rd_deal_to_meta_form_lead() from public;
revoke all on function public.prevent_zero_value_rd_sale() from public;
revoke all on function public.propagate_meta_form_attribution_to_sale() from public;
revoke all on function public.reconcile_meta_form_lead_arrival() from public;
