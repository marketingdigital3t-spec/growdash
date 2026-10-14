-- SaaS enforcement: centraliza acesso efetivo e consumo atômico de quotas.
-- Checkout/webhooks continuam deliberadamente fora desta migration até que o
-- provedor de cobrança seja escolhido.

CREATE INDEX IF NOT EXISTS idx_workspace_usage_monthly_lookup
  ON public.workspace_usage_monthly (workspace_id, metric, period);

CREATE OR REPLACE FUNCTION public.get_workspace_access_state(_workspace_id uuid)
RETURNS TABLE (
  workspace_id uuid,
  plan_code text,
  subscription_status text,
  access_allowed boolean,
  reason text,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  entitlements jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    subscription.workspace_id,
    subscription.plan_code,
    subscription.status,
    (
      subscription.status = 'active'
      AND (subscription.current_period_ends_at IS NULL OR subscription.current_period_ends_at > now())
    ) OR (
      subscription.status = 'trialing'
      AND (subscription.trial_ends_at IS NULL OR subscription.trial_ends_at > now())
    ) AS access_allowed,
    CASE
      WHEN subscription.status = 'trialing'
        AND subscription.trial_ends_at IS NOT NULL
        AND subscription.trial_ends_at <= now() THEN 'trial_expired'
      WHEN subscription.status = 'active'
        AND subscription.current_period_ends_at IS NOT NULL
        AND subscription.current_period_ends_at <= now() THEN 'period_expired'
      WHEN subscription.status = 'past_due' THEN 'payment_past_due'
      WHEN subscription.status = 'paused' THEN 'subscription_paused'
      WHEN subscription.status = 'canceled' THEN 'subscription_canceled'
      ELSE 'ok'
    END AS reason,
    subscription.trial_ends_at,
    subscription.current_period_ends_at,
    catalog.entitlements
  FROM public.workspace_subscriptions AS subscription
  JOIN public.plan_catalog AS catalog ON catalog.code = subscription.plan_code
  WHERE subscription.workspace_id = _workspace_id
    AND public.is_workspace_member(_workspace_id)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.consume_workspace_usage(
  _workspace_id uuid,
  _metric text,
  _amount numeric DEFAULT 1
)
RETURNS TABLE (
  allowed boolean,
  reason text,
  metric text,
  used numeric,
  quota numeric,
  period date
)
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
  SELECT date_trunc('month', now() AT TIME ZONE COALESCE(timezone, 'UTC'))::date
    INTO _period
  FROM public.workspaces
  WHERE id = _workspace_id;

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
  ON CONFLICT (workspace_id, metric, period) DO NOTHING;

  SELECT quantity INTO _used
  FROM public.workspace_usage_monthly
  WHERE workspace_id = _workspace_id AND metric = _metric AND period = _period
  FOR UPDATE;

  IF _used + _amount > _quota THEN
    RETURN QUERY SELECT false, 'quota_exceeded', _metric, _used, _quota, _period;
    RETURN;
  END IF;

  UPDATE public.workspace_usage_monthly
  SET quantity = quantity + _amount, updated_at = now()
  WHERE workspace_id = _workspace_id AND metric = _metric AND period = _period;

  RETURN QUERY SELECT true, 'ok', _metric, _used + _amount, _quota, _period;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_access_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_workspace_usage(uuid, text, numeric) TO authenticated;
