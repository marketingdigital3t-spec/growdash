-- Backend hardening for the Growdash automation engine.
-- Secrets are accepted only by trusted Edge Functions, never by the browser.

-- Legacy active webhooks without a secret were anonymous execution paths.
-- Pause them before enforcing the invariant so an operator can rotate and
-- explicitly reactivate them with a secret.
UPDATE public.growdash_workflow_webhooks
SET status = 'paused'
WHERE status = 'active' AND secret_hash IS NULL;

-- Keep old revoked/paused rows readable for audit history, while rejecting
-- every new or updated row without a secret. `NOT VALID` validates future
-- writes without making deployment fail on historical data.
ALTER TABLE public.growdash_workflow_webhooks
  DROP CONSTRAINT IF EXISTS growdash_workflow_webhooks_secret_required;
ALTER TABLE public.growdash_workflow_webhooks
  ADD CONSTRAINT growdash_workflow_webhooks_secret_required
  CHECK (secret_hash IS NOT NULL) NOT VALID;

-- The encrypted credential payload is backend-only. Workspace members may
-- list/use credentials through Edge Functions, but must not read ciphertext
-- through PostgREST/Data API.
REVOKE SELECT ON public.growdash_workflow_credentials FROM authenticated;

COMMENT ON COLUMN public.growdash_workflow_credentials.encrypted_payload IS
  'Backend-only encrypted credential payload; never exposed through the Data API.';
