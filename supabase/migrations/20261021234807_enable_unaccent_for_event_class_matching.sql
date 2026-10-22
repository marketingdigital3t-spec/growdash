-- The existing class-matching RPC and the RD-to-class trigger normalize
-- Portuguese custom-field keys with unaccent(). Ensure the extension exists
-- before either function is invoked.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

ALTER FUNCTION public.sync_event_class_members_from_rd(uuid)
  SET search_path = public, extensions;

ALTER FUNCTION public.sync_expert_sale_from_rd_deal()
  SET search_path = public, extensions;
