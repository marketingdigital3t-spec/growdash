-- Repair production schema drift in user_permissions.
-- Some legacy migrations are present in the migration ledger even though their
-- permission columns are absent from the live relation. Keep this migration
-- idempotent so it is safe in every environment.

ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS can_crm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_commercial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_leads boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_alerts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_users boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_integrations boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_announcements boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_automations boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_permissions.can_crm
  IS 'Allows access to the CRM module.';
COMMENT ON COLUMN public.user_permissions.can_commercial
  IS 'Allows access to the Commercial module.';
COMMENT ON COLUMN public.user_permissions.can_leads
  IS 'Allows access to incomplete leads.';
COMMENT ON COLUMN public.user_permissions.can_alerts
  IS 'Allows access to alerts.';
COMMENT ON COLUMN public.user_permissions.can_users
  IS 'Allows workspace user management.';
COMMENT ON COLUMN public.user_permissions.can_integrations
  IS 'Allows access to integrations.';
COMMENT ON COLUMN public.user_permissions.can_announcements
  IS 'Allows management of internal announcements.';
COMMENT ON COLUMN public.user_permissions.can_automations
  IS 'Allows access to automations.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
