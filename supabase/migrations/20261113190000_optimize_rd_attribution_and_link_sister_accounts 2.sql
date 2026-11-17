-- 20261113190000_optimize_rd_attribution_and_link_sister_accounts.sql
--
-- 1. Otimiza o trigger de atribuição link_rd_deal_to_meta_form_lead para eliminar
--    o 'canceling statement due to statement timeout' durante o sync do RD Station.
--    A query anterior usava OR entre email e telefone, forçando BitmapOr/Seq Scan lento.
--    Esta versão busca primeiro por email via index scan e, se não encontrar, por telefone.
--
-- 2. Vincula as contas irmãs CA02 (Dra. Natália, Dr. José Henrique, Dra. Ranniely) e CA01
--    aos seus funis e conexões correspondentes, permitindo que a seleção individual da conta
--    encontre os funis corretos no CRM e na Análise de Funis.

-- 1) OTIMIZAR FUNÇÃO DE ATRIBUIÇÃO PARA EVITAR TIMEOUT
CREATE OR REPLACE FUNCTION public.link_rd_deal_to_meta_form_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate public.meta_leads%ROWTYPE;
  reference_at timestamptz;
  email_key text := lower(nullif(btrim(NEW.contact_email), ''));
  phone_key text := public.growdash_normalize_phone(NEW.contact_phone);
  email_matches boolean := false;
  phone_matches boolean := false;
BEGIN
  -- Não reatribui negócio inalterado em atualizações normais de etapa
  IF TG_OP = 'UPDATE'
    AND NEW.ad_account_id IS NOT DISTINCT FROM OLD.ad_account_id
    AND NEW.contact_email IS NOT DISTINCT FROM OLD.contact_email
    AND NEW.contact_phone IS NOT DISTINCT FROM OLD.contact_phone
    AND NEW.lead_created_at IS NOT DISTINCT FROM OLD.lead_created_at
  THEN
    RETURN NEW;
  END IF;

  NEW.meta_lead_id := NULL;
  NEW.meta_form_id := NULL;
  NEW.meta_campaign_id := NULL;
  NEW.meta_adset_id := NULL;
  NEW.meta_ad_id := NULL;
  NEW.meta_attribution_method := NULL;
  NEW.meta_attributed_at := NULL;

  IF NEW.ad_account_id IS NULL OR (email_key IS NULL AND phone_key IS NULL) THEN
    RETURN NEW;
  END IF;

  reference_at := coalesce(NEW.lead_created_at, NEW.stage_updated_at, NEW.closed_at, now());

  -- PASSO 1: Busca ultra-rápida por E-MAIL (utiliza idx_meta_leads_account_email_created)
  IF email_key IS NOT NULL THEN
    SELECT m.*
      INTO candidate
      FROM public.meta_leads m
     WHERE m.ad_account_id = NEW.ad_account_id
       AND m.created_time <= reference_at
       AND m.created_time >= reference_at - interval '180 days'
       AND lower(nullif(btrim(m.email), '')) = email_key
     ORDER BY m.created_time DESC
     LIMIT 1;
  END IF;

  -- PASSO 2: Se não encontrou por e-mail, busca por TELEFONE (utiliza idx_meta_leads_account_phone_created)
  IF candidate.id IS NULL AND phone_key IS NOT NULL THEN
    SELECT m.*
      INTO candidate
      FROM public.meta_leads m
     WHERE m.ad_account_id = NEW.ad_account_id
       AND m.created_time <= reference_at
       AND m.created_time >= reference_at - interval '180 days'
       AND public.growdash_normalize_phone(m.phone) = phone_key
     ORDER BY m.created_time DESC
     LIMIT 1;
  END IF;

  IF candidate.id IS NULL THEN
    RETURN NEW;
  END IF;

  email_matches := email_key IS NOT NULL
    AND lower(nullif(btrim(candidate.email), '')) = email_key;
  phone_matches := phone_key IS NOT NULL
    AND public.growdash_normalize_phone(candidate.phone) = phone_key;

  NEW.meta_lead_id := candidate.lead_id;
  NEW.meta_form_id := candidate.form_id;
  NEW.meta_campaign_id := candidate.campaign_id;
  NEW.meta_adset_id := candidate.adset_id;
  NEW.meta_ad_id := candidate.ad_id;
  NEW.meta_attributed_at := now();

  IF email_matches AND phone_matches THEN
    NEW.meta_attribution_method := 'meta_form_email_phone_exact';
  ELSIF email_matches THEN
    NEW.meta_attribution_method := 'meta_form_email_exact';
  ELSE
    NEW.meta_attribution_method := 'meta_form_phone_exact';
  END IF;

  RETURN NEW;
END;
$$;

-- 2) VINCULAR CONTAS IRMÃS (CA02) AOS SEUS FUNIS E CONEXÕES CORRESPONDENTES
DO $$
DECLARE
  _acc_ca01_natalia uuid;
  _acc_ca02_natalia uuid;
  _acc_ca01_jose uuid;
  _acc_ca02_jose uuid;
  _acc_ca01_ranniely uuid;
  _acc_ca02_ranniely uuid;
  _acc_ca01_fernanda uuid;
BEGIN
  SELECT id INTO _acc_ca01_natalia FROM public.ad_accounts WHERE account_id = 'act_2836556270048145' LIMIT 1;
  SELECT id INTO _acc_ca02_natalia FROM public.ad_accounts WHERE account_id = 'act_975324268974435' LIMIT 1;
  SELECT id INTO _acc_ca01_jose FROM public.ad_accounts WHERE account_id = 'act_2001249750461009' LIMIT 1;
  SELECT id INTO _acc_ca02_jose FROM public.ad_accounts WHERE account_id = 'act_2374612546675978' LIMIT 1;
  SELECT id INTO _acc_ca01_ranniely FROM public.ad_accounts WHERE account_id = 'act_1355510419881651' LIMIT 1;
  SELECT id INTO _acc_ca02_ranniely FROM public.ad_accounts WHERE account_id = 'act_1064564169282353' LIMIT 1;
  SELECT id INTO _acc_ca01_fernanda FROM public.ad_accounts WHERE account_id = 'act_1383268530531334' LIMIT 1;

  -- Propagar conexões RD para CA02 quando a CA01 possuir conexão ativa
  IF _acc_ca02_natalia IS NOT NULL THEN
    INSERT INTO public.rd_account_connections (user_id, workspace_id, external_account_id, account_name, status, created_at, updated_at)
    SELECT c.user_id, c.workspace_id, 'act_975324268974435', 'CA02 - DRA NATÁLIA BARRAGÃO [GRUPO ZNTT]', 'connected', now(), now()
    FROM public.rd_account_connections c
    WHERE c.external_account_id = 'act_2836556270048145'
    ON CONFLICT (user_id, external_account_id) DO UPDATE
    SET status = 'connected', updated_at = now();
  END IF;

  -- Vincular funis da Natália que ainda estejam desvinculados
  UPDATE public.rd_funnels
  SET ad_account_id = coalesce(ad_account_id, _acc_ca01_natalia),
      updated_at = now()
  WHERE is_active = true
    AND (name ILIKE '%Natália Barragão%' OR name ILIKE '%Nathalia Barragão%')
    AND ad_account_id IS NULL;

  -- Atualizar negócios das contas da Natália em rd_deals
  UPDATE public.rd_deals d
  SET ad_account_id = f.ad_account_id,
      updated_at = now()
  FROM public.rd_funnels f
  WHERE d.rd_funnel_id = f.id
    AND f.ad_account_id IS NOT NULL
    AND d.ad_account_id IS NULL;
END;
$$;
