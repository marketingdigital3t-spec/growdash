-- Confirm RD snapshots for the exact funnel and civil-date scope requested.
-- A connection-level timestamp cannot prove that an empty period was queried.
CREATE TABLE IF NOT EXISTS public.rd_sync_scope_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid NOT NULL REFERENCES public.rd_funnels(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  status text NOT NULL DEFAULT 'idle',
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  covered_start_date date,
  covered_end_date date,
  rows_persisted integer NOT NULL DEFAULT 0,
  pages_processed integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rd_sync_scope_state_dates_valid CHECK (start_date <= end_date),
  UNIQUE (funnel_id, start_date, end_date, timezone)
);

CREATE INDEX IF NOT EXISTS rd_sync_scope_state_funnel_period_idx
  ON public.rd_sync_scope_state (funnel_id, start_date, end_date, updated_at DESC);

ALTER TABLE public.rd_sync_scope_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own RD sync scope state"
  ON public.rd_sync_scope_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rd_funnels f
      WHERE f.id = rd_sync_scope_state.funnel_id
        AND (f.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role))
    )
  );
REVOKE ALL ON public.rd_sync_scope_state FROM PUBLIC;
GRANT SELECT ON public.rd_sync_scope_state TO authenticated;
GRANT ALL ON public.rd_sync_scope_state TO service_role;
