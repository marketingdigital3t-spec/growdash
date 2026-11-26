-- First-class RD connections prevent a user-level token from mixing accounts.
CREATE TABLE IF NOT EXISTS public.rd_account_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  external_account_id text,
  account_name text NOT NULL,
  api_token text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','blocked','partial','failed')),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rd_account_connections_owner_external_uidx
  ON public.rd_account_connections (user_id, external_account_id)
  WHERE external_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rd_account_connections_workspace_idx
  ON public.rd_account_connections (workspace_id, user_id);

ALTER TABLE public.rd_account_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own RD connections" ON public.rd_account_connections;
CREATE POLICY "Users view own RD connections" ON public.rd_account_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own RD connections" ON public.rd_account_connections;
CREATE POLICY "Users manage own RD connections" ON public.rd_account_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.rd_funnels
  ALTER COLUMN ad_account_id DROP NOT NULL;
ALTER TABLE public.rd_funnels
  ADD COLUMN IF NOT EXISTS rd_connection_id uuid REFERENCES public.rd_account_connections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS rd_funnels_connection_idx ON public.rd_funnels(rd_connection_id);

ALTER TABLE public.rd_deals
  ALTER COLUMN ad_account_id DROP NOT NULL;
ALTER TABLE public.rd_deals
  ADD COLUMN IF NOT EXISTS rd_connection_id uuid REFERENCES public.rd_account_connections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS rd_deals_connection_idx ON public.rd_deals(rd_connection_id);

-- Keep provider identity unique per connection while retaining old rows that
-- have not yet been backfilled with a connection id.
CREATE UNIQUE INDEX IF NOT EXISTS rd_deals_connection_external_uidx
  ON public.rd_deals (rd_connection_id, rd_deal_id)
  WHERE rd_connection_id IS NOT NULL AND rd_deal_id IS NOT NULL;

COMMENT ON TABLE public.rd_account_connections IS 'One independently auditable RD Station connection per account.';
COMMENT ON COLUMN public.rd_funnels.ad_account_id IS 'Optional Meta link; NULL means RD-only funnel.';

-- Existing policies were written around a mandatory Meta account. Extend them
-- so an RD-only funnel/deal remains visible to its owner or connection owner.
DROP POLICY IF EXISTS "View rd funnels" ON public.rd_funnels;
CREATE POLICY "View rd funnels" ON public.rd_funnels FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = user_id
    OR (rd_connection_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.rd_account_connections c
      WHERE c.id = rd_connection_id AND c.user_id = auth.uid()
    ))
    OR (ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ad_account_id))
  );
DROP POLICY IF EXISTS "Insert rd funnels" ON public.rd_funnels;
CREATE POLICY "Insert rd funnels" ON public.rd_funnels FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = user_id AND (
      ad_account_id IS NULL OR public.user_owns_ad_account(auth.uid(), ad_account_id)
    ))
  );
DROP POLICY IF EXISTS "Update rd funnels" ON public.rd_funnels;
CREATE POLICY "Update rd funnels" ON public.rd_funnels FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id OR (ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ad_account_id)));
DROP POLICY IF EXISTS "Delete rd funnels" ON public.rd_funnels;
CREATE POLICY "Delete rd funnels" ON public.rd_funnels FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id OR (ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ad_account_id)));

DROP POLICY IF EXISTS "View rd_deals" ON public.rd_deals;
CREATE POLICY "View rd_deals" ON public.rd_deals FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = user_id
    OR (rd_connection_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.rd_account_connections c
      WHERE c.id = rd_connection_id AND c.user_id = auth.uid()
    ))
    OR (ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ad_account_id))
  );
