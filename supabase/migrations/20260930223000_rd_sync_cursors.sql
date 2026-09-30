-- Cursor resumable for bounded RD analytics runs. A five-minute run can stop
-- at the Edge runtime budget and resume the exact funnel/status/page later.
CREATE TABLE IF NOT EXISTS public.rd_sync_cursors (
  scope_key text PRIMARY KEY,
  funnel_id uuid NOT NULL REFERENCES public.rd_funnels(id) ON DELETE CASCADE,
  rd_connection_id uuid REFERENCES public.rd_account_connections(id) ON DELETE CASCADE,
  start_date date,
  end_date date,
  segment text NOT NULL,
  next_page integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','partial','complete','error')),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rd_sync_cursors_funnel_idx
  ON public.rd_sync_cursors (funnel_id, updated_at DESC);

ALTER TABLE public.rd_sync_cursors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rd_sync_cursors_owner_read ON public.rd_sync_cursors;
CREATE POLICY rd_sync_cursors_owner_read ON public.rd_sync_cursors
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rd_funnels f
    WHERE f.id = funnel_id AND (f.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
GRANT SELECT ON public.rd_sync_cursors TO authenticated;
GRANT ALL ON public.rd_sync_cursors TO service_role;
