-- Hardening identified by the production security advisor.
-- unaccent is an implementation detail of the legacy class-member matcher;
-- keep it out of the exposed public schema while preserving that function.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;

ALTER FUNCTION public.sync_event_class_members_from_rd(uuid)
  SET search_path = public, extensions;

-- This routine is invoked by pg_cron and by trusted server-side code only.
-- Public questionnaire submission still calls it internally under SECURITY DEFINER,
-- but callers must not be able to invoke the cleanup routine directly.
REVOKE ALL ON FUNCTION public.expire_expert_questionnaire_links() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_expert_questionnaire_links() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_expert_questionnaire_links() TO service_role;
