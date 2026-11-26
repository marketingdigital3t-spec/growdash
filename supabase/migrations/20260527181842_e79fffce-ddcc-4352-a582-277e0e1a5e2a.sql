
ALTER TABLE public.meta_leads
  ADD COLUMN IF NOT EXISTS lead_state_source text;

CREATE INDEX IF NOT EXISTS idx_meta_leads_acc_time
  ON public.meta_leads (ad_account_id, created_time);

CREATE OR REPLACE FUNCTION public.infer_uf_from_phone(_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
  ddd text;
BEGIN
  IF _phone IS NULL THEN RETURN NULL; END IF;
  digits := regexp_replace(_phone, '\D', '', 'g');
  IF length(digits) < 10 THEN RETURN NULL; END IF;
  -- Strip country code 55 if present and result has >= 10 digits remaining
  IF left(digits, 2) = '55' AND length(digits) >= 12 THEN
    digits := substring(digits FROM 3);
  END IF;
  IF length(digits) < 10 THEN RETURN NULL; END IF;
  ddd := left(digits, 2);
  RETURN CASE ddd
    WHEN '11' THEN 'SP' WHEN '12' THEN 'SP' WHEN '13' THEN 'SP' WHEN '14' THEN 'SP'
    WHEN '15' THEN 'SP' WHEN '16' THEN 'SP' WHEN '17' THEN 'SP' WHEN '18' THEN 'SP' WHEN '19' THEN 'SP'
    WHEN '21' THEN 'RJ' WHEN '22' THEN 'RJ' WHEN '24' THEN 'RJ'
    WHEN '27' THEN 'ES' WHEN '28' THEN 'ES'
    WHEN '31' THEN 'MG' WHEN '32' THEN 'MG' WHEN '33' THEN 'MG' WHEN '34' THEN 'MG'
    WHEN '35' THEN 'MG' WHEN '37' THEN 'MG' WHEN '38' THEN 'MG'
    WHEN '41' THEN 'PR' WHEN '42' THEN 'PR' WHEN '43' THEN 'PR' WHEN '44' THEN 'PR' WHEN '45' THEN 'PR' WHEN '46' THEN 'PR'
    WHEN '47' THEN 'SC' WHEN '48' THEN 'SC' WHEN '49' THEN 'SC'
    WHEN '51' THEN 'RS' WHEN '53' THEN 'RS' WHEN '54' THEN 'RS' WHEN '55' THEN 'RS'
    WHEN '61' THEN 'DF'
    WHEN '62' THEN 'GO' WHEN '64' THEN 'GO'
    WHEN '63' THEN 'TO'
    WHEN '65' THEN 'MT' WHEN '66' THEN 'MT'
    WHEN '67' THEN 'MS'
    WHEN '68' THEN 'AC'
    WHEN '69' THEN 'RO'
    WHEN '71' THEN 'BA' WHEN '73' THEN 'BA' WHEN '74' THEN 'BA' WHEN '75' THEN 'BA' WHEN '77' THEN 'BA'
    WHEN '79' THEN 'SE'
    WHEN '81' THEN 'PE' WHEN '87' THEN 'PE'
    WHEN '82' THEN 'AL'
    WHEN '83' THEN 'PB'
    WHEN '84' THEN 'RN'
    WHEN '85' THEN 'CE' WHEN '88' THEN 'CE'
    WHEN '86' THEN 'PI' WHEN '89' THEN 'PI'
    WHEN '91' THEN 'PA' WHEN '93' THEN 'PA' WHEN '94' THEN 'PA'
    WHEN '92' THEN 'AM' WHEN '97' THEN 'AM'
    WHEN '95' THEN 'RR'
    WHEN '96' THEN 'AP'
    WHEN '98' THEN 'MA' WHEN '99' THEN 'MA'
    ELSE NULL
  END;
END;
$$;

-- Mark already-filled rows as 'form' if not set
UPDATE public.meta_leads
SET lead_state_source = 'form'
WHERE lead_state IS NOT NULL AND lead_state_source IS NULL;

-- Backfill via DDD where state is missing but phone exists
UPDATE public.meta_leads
SET
  lead_state = public.infer_uf_from_phone(phone),
  lead_state_source = 'ddd'
WHERE lead_state IS NULL
  AND phone IS NOT NULL
  AND public.infer_uf_from_phone(phone) IS NOT NULL;
