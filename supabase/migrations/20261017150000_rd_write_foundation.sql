-- Governed RD writes are opt-in and auditable. The read/sync mirror remains
-- unchanged; this migration only adds the guard rails used by future writes.
ALTER TABLE public.rd_account_connections
  ADD COLUMN IF NOT EXISTS write_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS write_updated_at timestamptz;

COMMENT ON COLUMN public.rd_account_connections.write_enabled IS
  'Explicit owner opt-in required before Growdash can write to this RD connection.';

CREATE TABLE IF NOT EXISTS public.rd_write_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rd_connection_id uuid NOT NULL REFERENCES public.rd_account_connections(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao text NOT NULL CHECK (acao IN ('move_stage', 'update_deal', 'update_contact', 'create_contact')),
  alvo jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_antes jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_depois jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'rolled_back')),
  erro text,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rd_connection_id, correlation_id)
);

CREATE INDEX IF NOT EXISTS rd_write_audit_connection_created_idx
  ON public.rd_write_audit (rd_connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rd_write_audit_status_idx
  ON public.rd_write_audit (status, created_at DESC);

ALTER TABLE public.rd_write_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rd_write_audit FROM PUBLIC, anon;
GRANT SELECT ON public.rd_write_audit TO authenticated;
GRANT ALL ON public.rd_write_audit TO service_role;

DROP POLICY IF EXISTS rd_write_audit_read_authorized ON public.rd_write_audit;
CREATE POLICY rd_write_audit_read_authorized
  ON public.rd_write_audit FOR SELECT TO authenticated
  USING (
    usuario_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.rd_account_connections connection
      WHERE connection.id = rd_write_audit.rd_connection_id
        AND (
          connection.user_id = (SELECT auth.uid())
          OR (
            connection.workspace_id IS NOT NULL
            AND public.can_manage_workspace(connection.workspace_id, (SELECT auth.uid()))
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.touch_rd_write_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.write_enabled IS DISTINCT FROM OLD.write_enabled THEN
    NEW.write_updated_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rd_account_connections_write_timestamp ON public.rd_account_connections;
CREATE TRIGGER rd_account_connections_write_timestamp
  BEFORE UPDATE OF write_enabled ON public.rd_account_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_rd_write_updated_at();

COMMENT ON TABLE public.rd_write_audit IS
  'Append-only audit trail for governed RD Station writes; rows are created before provider calls.';
