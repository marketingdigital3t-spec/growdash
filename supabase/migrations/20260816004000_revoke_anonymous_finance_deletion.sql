-- Finance history deletion requires an authenticated workspace finance role.
-- Remove the legacy explicit anonymous grant left after PUBLIC was revoked.
REVOKE ALL ON FUNCTION public.delete_financial_document_history(uuid, uuid[], boolean) FROM anon;
