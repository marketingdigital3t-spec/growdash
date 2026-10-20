-- Repair native Meta form leads whose phone field uses a custom Portuguese
-- label (for example `digite_aqui_seu_whats`). The webhook now recognizes
-- these labels for future events; this backfill makes existing rows eligible
-- for the same email/phone match against rd_deals.
WITH candidates AS (
  SELECT
    m.meta_lead_id,
    candidate.value
  FROM public.meta_leads AS m
  CROSS JOIN LATERAL (
    SELECT NULLIF(btrim(item->'values'->>0), '') AS value
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(m.field_data) = 'array' THEN m.field_data
        ELSE '[]'::jsonb
      END
    ) AS item
    WHERE (
      regexp_replace(lower(coalesce(item->>'name', '')), '[^a-z0-9]', '', 'g') LIKE '%whatsapp%'
      OR regexp_replace(lower(coalesce(item->>'name', '')), '[^a-z0-9]', '', 'g') LIKE '%whats%'
      OR regexp_replace(lower(coalesce(item->>'name', '')), '[^a-z0-9]', '', 'g') LIKE '%telefone%'
      OR regexp_replace(lower(coalesce(item->>'name', '')), '[^a-z0-9]', '', 'g') LIKE '%celular%'
      OR regexp_replace(lower(coalesce(item->>'name', '')), '[^a-z0-9]', '', 'g') LIKE '%phone%'
    )
    AND NULLIF(regexp_replace(item->'values'->>0, '[^0-9]', '', 'g'), '') IS NOT NULL
    ORDER BY CASE
      WHEN regexp_replace(lower(coalesce(item->>'name', '')), '[^a-z0-9]', '', 'g') LIKE '%whatsapp%' THEN 0
      WHEN regexp_replace(lower(coalesce(item->>'name', '')), '[^a-z0-9]', '', 'g') LIKE '%whats%' THEN 1
      WHEN regexp_replace(lower(coalesce(item->>'name', '')), '[^a-z0-9]', '', 'g') LIKE '%telefone%' THEN 2
      WHEN regexp_replace(lower(coalesce(item->>'name', '')), '[^a-z0-9]', '', 'g') LIKE '%celular%' THEN 3
      ELSE 4
    END
    LIMIT 1
  ) AS candidate
  WHERE (m.phone IS NULL OR NULLIF(regexp_replace(m.phone, '[^0-9]', '', 'g'), '') IS NULL)
)
UPDATE public.meta_leads AS m
SET phone = candidates.value
FROM candidates
WHERE m.meta_lead_id = candidates.meta_lead_id;
