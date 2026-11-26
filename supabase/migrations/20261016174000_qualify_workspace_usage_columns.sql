-- Qualify the remaining workspace_usage_monthly references that are shadowed
-- by the function's RETURNS TABLE(metric ...) output column.

CREATE OR REPLACE FUNCTION public.consume_workspace_usage(
  _workspace_id uuid,
  _metric text,
  _amount numeric DEFAULT 1
)
RETURNS TABLE(allowed boolean, reason text, metric text, used numeric, quota numeric, period date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _access record;
  _period date;
  _used numeric := 0;
  _quota numeric;
BEGIN
  SELECT date_trunc('month', now() AT TIME ZONE COALESCE(workspace.timezone, 'UTC'))::date
    INTO _period
  FROM public.workspaces workspace
  WHERE workspace.id = _workspace_id;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'usage amount must be positive';
  END IF;
  IF NOT public.is_workspace_member(_workspace_id) THEN
    RAISE EXCEPTION 'workspace access denied';
  END IF;

  SELECT * INTO _access
  FROM public.get_workspace_access_state(_workspace_id);

  IF _access.workspace_id IS NULL OR NOT _access.access_allowed THEN
    RETURN QUERY SELECT false, COALESCE(_access.reason, 'subscription_unavailable'), _metric, 0::numeric, 0::numeric, _period;
    RETURN;
  END IF;

  _quota := NULLIF((_access.entitlements ->> _metric), '')::numeric;
  IF _quota IS NULL THEN
    RETURN QUERY SELECT false, 'metric_not_configured', _metric, 0::numeric, 0::numeric, _period;
    RETURN;
  END IF;

  INSERT INTO public.workspace_usage_monthly (workspace_id, metric, period, quantity)
  VALUES (_workspace_id, _metric, _period, 0)
  ON CONFLICT ON CONSTRAINT workspace_usage_monthly_workspace_id_metric_period_key DO NOTHING;

  SELECT usage_row.quantity INTO _used
  FROM public.workspace_usage_monthly usage_row
  WHERE usage_row.workspace_id = _workspace_id
    AND usage_row.metric = _metric
    AND usage_row.period = _period
  FOR UPDATE;

  IF _used + _amount > _quota THEN
    RETURN QUERY SELECT false, 'quota_exceeded', _metric, _used, _quota, _period;
    RETURN;
  END IF;

  UPDATE public.workspace_usage_monthly usage_row
  SET quantity = usage_row.quantity + _amount, updated_at = now()
  WHERE usage_row.workspace_id = _workspace_id
    AND usage_row.metric = _metric
    AND usage_row.period = _period;

  RETURN QUERY SELECT true, 'ok', _metric, _used + _amount, _quota, _period;
END;
$$;
