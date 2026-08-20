-- Valor de referência exclusivo da Ranniely para vendas que chegam do RD
-- sem preço. O valor original do RD é preservado para auditoria; somente o
-- campo efetivo alimenta CRM e a venda canônica.
ALTER TABLE public.rd_deals
  ADD COLUMN IF NOT EXISTS amount_total_original numeric,
  ADD COLUMN IF NOT EXISTS amount_total_manual numeric,
  ADD COLUMN IF NOT EXISTS amount_total_effective numeric,
  ADD COLUMN IF NOT EXISTS manual_override_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_override_reason text,
  ADD COLUMN IF NOT EXISTS manual_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_override_by uuid;

CREATE OR REPLACE FUNCTION public.apply_rd_deal_effective_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_ranniely boolean := false;
  _rd_amount numeric := greatest(coalesce(NEW.amount_total, 0), 0);
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.ad_accounts account
    WHERE account.id = NEW.ad_account_id
      AND lower(coalesce(account.name, '')) LIKE '%ranniely%'
  ) INTO _is_ranniely;

  -- Guarda o valor recebido do RD antes de aplicar qualquer valor padrão.
  -- Em sincronizações seguintes, o RD pode reenviar zero; neste caso o
  -- original continua sendo zero e o padrão é reaplicado de forma idempotente.
  NEW.amount_total_original := CASE
    WHEN TG_OP <> 'INSERT' AND _rd_amount = 15000 AND coalesce(OLD.amount_total_original, 0) = 0 THEN 0
    ELSE _rd_amount
  END;
  IF NEW.manual_override_enabled AND coalesce(NEW.amount_total_manual, 0) > 0 THEN
    NEW.amount_total_effective := NEW.amount_total_manual;
  ELSIF NEW.win AND _is_ranniely AND _rd_amount = 0 THEN
    NEW.amount_total_effective := 15000;
    NEW.amount_total := 15000;
  ELSE
    NEW.amount_total_effective := _rd_amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_rd_deal_effective_amount ON public.rd_deals;
CREATE TRIGGER trg_apply_rd_deal_effective_amount
BEFORE INSERT OR UPDATE OF amount_total, win, ad_account_id, manual_override_enabled, amount_total_manual
ON public.rd_deals
FOR EACH ROW EXECUTE FUNCTION public.apply_rd_deal_effective_amount();

-- Recalcula somente vendas de uma conta cujo nome contém Ranniely e cujo
-- valor original é zero. Não altera valores recebidos do RD em outras contas.
UPDATE public.rd_deals d SET amount_total = amount_total
  FROM public.ad_accounts account
 WHERE account.id = d.ad_account_id
   AND d.win = true
   AND coalesce(d.amount_total, 0) = 0
   AND lower(coalesce(account.name, '')) LIKE '%ranniely%';
