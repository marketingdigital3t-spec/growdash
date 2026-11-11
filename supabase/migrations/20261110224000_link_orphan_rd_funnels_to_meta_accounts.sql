-- 20261110224000_link_orphan_rd_funnels_to_meta_accounts.sql
-- Vincula os funis RD órfãos (que estavam com ad_account_id = null herdados
-- de conexões desativadas) às contas Meta ativas do Grupo ZNTT,
-- permitindo que as negociações apareçam no CRM e na Análise de Funis.

DO $$
DECLARE
  _acc_fernanda uuid;
  _acc_natalia uuid;
  _acc_ranniely uuid;
BEGIN
  -- 1) Localizar os IDs das contas Meta ativas do grupo pelo act_ canônico
  SELECT id INTO _acc_fernanda FROM public.ad_accounts WHERE account_id = 'act_1383268530531334' LIMIT 1;
  SELECT id INTO _acc_natalia FROM public.ad_accounts WHERE account_id = 'act_2836556270048145' LIMIT 1;
  SELECT id INTO _acc_ranniely FROM public.ad_accounts WHERE account_id = 'act_1355510419881651' LIMIT 1;

  -- 2) Vincular funis da Dra. Ste Andrade à CA01 Fernanda
  IF _acc_fernanda IS NOT NULL THEN
    UPDATE public.rd_funnels
    SET ad_account_id = _acc_fernanda,
        updated_at = now()
    WHERE ad_account_id IS NULL
      AND name ILIKE '%Ste Andrade%';
  END IF;

  -- 3) Vincular funis de Expansão e Dra. Natália à CA01 Natália Barragão
  IF _acc_natalia IS NOT NULL THEN
    UPDATE public.rd_funnels
    SET ad_account_id = _acc_natalia,
        updated_at = now()
    WHERE ad_account_id IS NULL
      AND (
        name ILIKE '%[Expansão]%'
        OR name ILIKE '%Natália Barragão%'
        OR name ILIKE '%Nathalia Barragão%'
      );
  END IF;

  -- 4) Vincular funis de Instituto/Clínica e Plano Comercial à CA01 Ranniely Silva
  IF _acc_ranniely IS NOT NULL THEN
    UPDATE public.rd_funnels
    SET ad_account_id = _acc_ranniely,
        updated_at = now()
    WHERE ad_account_id IS NULL
      AND (
        name ILIKE '%Carla Rezende%'
        OR name ILIKE '%Palazzo%'
        OR name ILIKE '%João Appolinário%'
        OR name ILIKE '%Plano Comercial%'
      );
  END IF;

  -- 5) Propagar o ad_account_id para as negociações existentes nos mesmos funis
  UPDATE public.rd_deals d
  SET ad_account_id = f.ad_account_id,
      updated_at = now()
  FROM public.rd_funnels f
  WHERE d.rd_funnel_id = f.id
    AND f.ad_account_id IS NOT NULL
    AND d.ad_account_id IS NULL;
END;
$$;
