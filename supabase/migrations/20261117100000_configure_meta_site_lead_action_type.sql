-- Configura action_type para contas Meta ativas que não possuem configuração.
-- Sem action_type, eventos de site (landing_page_view, purchase, etc.) não são
-- mapeados como leads, causando campanhas com spend e 0 leads reportados.
-- Usa 'landing_page_view' como padrão: é o evento de site mais comum para
-- campanhas de tráfego e conversão, e não infla leads falsos.
INSERT INTO public.account_lp_config (ad_account_id, action_type, pixel_id, updated_at)
SELECT id, 'landing_page_view', NULL, now()
FROM public.ad_accounts
WHERE connection_status = 'connected'
  AND NOT EXISTS (
    SELECT 1 FROM public.account_lp_config c
    WHERE c.ad_account_id = public.ad_accounts.id
      AND c.action_type IS NOT NULL
  )
ON CONFLICT (ad_account_id) DO UPDATE
SET action_type = EXCLUDED.action_type,
    updated_at = now();

COMMENT ON COLUMN public.account_lp_config.action_type IS
  'Evento de site considerado como lead para esta conta Meta. Preenchido para contas ativas sem configuração para evitar campanhas com spend e 0 leads.';
