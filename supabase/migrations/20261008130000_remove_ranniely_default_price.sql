-- O valor oficial de um negócio ganho deve vir do RD Station. A regra antiga
-- que transformava valor zero da Ranniely em R$ 15.000 criava divergência com
-- o CRM e não representa um valor confirmado pelo RD.

DROP TRIGGER IF EXISTS trg_apply_rd_deal_effective_amount ON public.rd_deals;

CREATE OR REPLACE FUNCTION public.apply_rd_deal_effective_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rd_amount numeric := greatest(coalesce(NEW.amount_total, 0), 0);
BEGIN
  -- Mantém o valor recebido do RD para auditoria. Somente um override manual
  -- explicitamente habilitado pode substituir o valor do provedor.
  NEW.amount_total_original := _rd_amount;
  IF NEW.manual_override_enabled AND coalesce(NEW.amount_total_manual, 0) > 0 THEN
    NEW.amount_total_effective := NEW.amount_total_manual;
  ELSE
    NEW.amount_total_effective := _rd_amount;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_rd_deal_effective_amount
BEFORE INSERT OR UPDATE OF amount_total, win, ad_account_id, manual_override_enabled, amount_total_manual
ON public.rd_deals
FOR EACH ROW EXECUTE FUNCTION public.apply_rd_deal_effective_amount();

-- Corrige registros antigos alterados pela regra fixa, sem tocar em overrides
-- manuais auditáveis. Nas demais linhas, o valor original normalmente já é
-- igual ao valor atual e a operação é idempotente.
UPDATE public.rd_deals
SET amount_total = amount_total_original,
    amount_total_effective = CASE
      WHEN manual_override_enabled AND coalesce(amount_total_manual, 0) > 0 THEN amount_total_manual
      ELSE amount_total_original
    END
WHERE manual_override_enabled = false
  AND amount_total_original IS NOT NULL;

