
-- 1) Add lead_state_source column to rd_deals
ALTER TABLE public.rd_deals
  ADD COLUMN IF NOT EXISTS lead_state_source text;

-- 2) Normalize existing lead_state values (full name -> UF, trim spaces)
CREATE OR REPLACE FUNCTION public._normalize_uf(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _raw IS NULL THEN NULL
    WHEN length(trim(_raw)) = 0 THEN NULL
    WHEN length(trim(_raw)) = 2 THEN upper(trim(_raw))
    ELSE (
      SELECT uf FROM (VALUES
        ('acre','AC'),('alagoas','AL'),('amapa','AP'),('amapá','AP'),('amazonas','AM'),
        ('bahia','BA'),('ceara','CE'),('ceará','CE'),('distrito federal','DF'),
        ('espirito santo','ES'),('espírito santo','ES'),('goias','GO'),('goiás','GO'),
        ('maranhao','MA'),('maranhão','MA'),('mato grosso','MT'),
        ('mato grosso do sul','MS'),('minas gerais','MG'),('para','PA'),('pará','PA'),
        ('paraiba','PB'),('paraíba','PB'),('parana','PR'),('paraná','PR'),
        ('pernambuco','PE'),('piaui','PI'),('piauí','PI'),('rio de janeiro','RJ'),
        ('rio grande do norte','RN'),('rio grande do sul','RS'),('rondonia','RO'),
        ('rondônia','RO'),('roraima','RR'),('santa catarina','SC'),('sao paulo','SP'),
        ('são paulo','SP'),('sergipe','SE'),('tocantins','TO')
      ) AS m(name, uf)
      WHERE m.name = lower(trim(_raw))
      LIMIT 1
    )
  END
$$;

UPDATE public.rd_deals
SET lead_state = public._normalize_uf(lead_state)
WHERE lead_state IS NOT NULL
  AND (length(lead_state) <> 2 OR lead_state <> upper(lead_state) OR lead_state LIKE ' %' OR lead_state LIKE '% ');

UPDATE public.sales
SET lead_state = public._normalize_uf(lead_state)
WHERE lead_state IS NOT NULL
  AND (length(lead_state) <> 2 OR lead_state <> upper(lead_state) OR lead_state LIKE ' %' OR lead_state LIKE '% ');

-- 3) Backfill lead_state_source by inspecting raw payload
UPDATE public.rd_deals
SET lead_state_source = CASE
  WHEN lead_state IS NULL THEN NULL
  WHEN (raw->'contact'->>'state') IS NOT NULL AND length(trim(raw->'contact'->>'state')) > 0 THEN 'rd_contact'
  WHEN (raw->'_contacts'->0->>'state') IS NOT NULL AND length(trim(raw->'_contacts'->0->>'state')) > 0 THEN 'rd_contact'
  WHEN public.infer_uf_from_phone(raw->'_contacts'->0->'phones'->0->>'whatsapp_full_internacional') = lead_state THEN 'ddd_phone'
  WHEN public.infer_uf_from_phone(raw->'_contacts'->0->'phones'->0->>'phone') = lead_state THEN 'ddd_phone'
  WHEN public.infer_uf_from_phone(raw->'contact'->'phones'->0->>'phone') = lead_state THEN 'ddd_phone'
  ELSE 'rd_custom_field'
END
WHERE lead_state_source IS NULL;
