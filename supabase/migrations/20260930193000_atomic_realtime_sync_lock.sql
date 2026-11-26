-- Atomic lock acquisition for controlled realtime syncs. A forced refresh may
-- bypass freshness throttling, but never an active writer.
CREATE OR REPLACE FUNCTION public.acquire_realtime_sync_lock(
  p_user_id uuid,
  p_provider text,
  p_scope_key text,
  p_now timestamptz,
  p_locked_until timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.realtime_sync_state (
    user_id, provider, scope_key, status, last_started_at, locked_until, updated_at
  ) VALUES (
    p_user_id, p_provider, p_scope_key, 'running', p_now, p_locked_until, p_now
  )
  ON CONFLICT (user_id, provider, scope_key) DO UPDATE SET
    status = 'running',
    last_started_at = EXCLUDED.last_started_at,
    locked_until = EXCLUDED.locked_until,
    updated_at = EXCLUDED.updated_at
  WHERE public.realtime_sync_state.locked_until IS NULL
     OR public.realtime_sync_state.locked_until <= p_now;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_realtime_sync_lock(uuid, text, text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_realtime_sync_lock(uuid, text, text, timestamptz, timestamptz) TO service_role;
