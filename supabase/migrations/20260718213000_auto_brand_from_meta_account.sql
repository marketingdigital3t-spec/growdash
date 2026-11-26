-- Every integrated Meta ad account is also a Growdash brand.
-- Idempotent by (workspace_id, name), safe for existing integrations and future updates.

CREATE OR REPLACE FUNCTION public.sync_company_from_ad_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  _name := COALESCE(NULLIF(btrim(NEW.name), ''), 'Conta Meta ' || NEW.account_id);

  INSERT INTO public.companies (
    workspace_id,
    business_unit_id,
    name,
    status,
    metadata
  )
  VALUES (
    NEW.workspace_id,
    NEW.business_unit_id,
    _name,
    'active',
    jsonb_strip_nulls(jsonb_build_object(
      'source', 'meta_ads',
      'ad_account_id', NEW.id,
      'meta_account_id', NEW.account_id,
      'auto_created', true
    ))
  )
  ON CONFLICT (workspace_id, name) DO UPDATE
  SET business_unit_id = COALESCE(EXCLUDED.business_unit_id, public.companies.business_unit_id),
      status = CASE WHEN public.companies.status = 'archived' THEN public.companies.status ELSE 'active' END,
      metadata = COALESCE(public.companies.metadata, '{}'::jsonb) || EXCLUDED.metadata,
      updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_company_from_ad_account ON public.ad_accounts;
CREATE TRIGGER trg_sync_company_from_ad_account
AFTER INSERT OR UPDATE OF workspace_id, business_unit_id, account_id, name
ON public.ad_accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_company_from_ad_account();

-- Backfill all accounts integrated before this rule existed.
INSERT INTO public.companies (
  workspace_id,
  business_unit_id,
  name,
  status,
  metadata
)
SELECT
  account.workspace_id,
  account.business_unit_id,
  COALESCE(NULLIF(btrim(account.name), ''), 'Conta Meta ' || account.account_id),
  'active',
  jsonb_strip_nulls(jsonb_build_object(
    'source', 'meta_ads',
    'ad_account_id', account.id,
    'meta_account_id', account.account_id,
    'auto_created', true
  ))
FROM public.ad_accounts account
WHERE account.workspace_id IS NOT NULL
ON CONFLICT (workspace_id, name) DO UPDATE
SET business_unit_id = COALESCE(EXCLUDED.business_unit_id, public.companies.business_unit_id),
    metadata = COALESCE(public.companies.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

GRANT EXECUTE ON FUNCTION public.sync_company_from_ad_account() TO authenticated, service_role;
