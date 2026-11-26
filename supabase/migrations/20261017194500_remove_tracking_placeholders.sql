-- O RD/Make pode enviar tokens literais ({{utm_campaign}}) quando o campo
-- não foi resolvido. Eles não são atribuição e não podem aparecer como nome.
UPDATE public.rd_deals
SET
  utm_source = CASE WHEN btrim(coalesce(utm_source, '')) ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(utm_source), '') END,
  utm_medium = CASE WHEN btrim(coalesce(utm_medium, '')) ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(utm_medium), '') END,
  utm_campaign = CASE WHEN btrim(coalesce(utm_campaign, '')) ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(utm_campaign), '') END,
  utm_term = CASE WHEN btrim(coalesce(utm_term, '')) ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(utm_term), '') END,
  utm_content = CASE WHEN btrim(coalesce(utm_content, '')) ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(utm_content), '') END,
  utm_id = CASE WHEN btrim(coalesce(utm_id, '')) ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(utm_id), '') END,
  updated_at = now()
WHERE btrim(coalesce(utm_source, '')) ~ '^\{\{[^{}]+\}\}$'
   OR btrim(coalesce(utm_medium, '')) ~ '^\{\{[^{}]+\}\}$'
   OR btrim(coalesce(utm_campaign, '')) ~ '^\{\{[^{}]+\}\}$'
   OR btrim(coalesce(utm_term, '')) ~ '^\{\{[^{}]+\}\}$'
   OR btrim(coalesce(utm_content, '')) ~ '^\{\{[^{}]+\}\}$'
   OR btrim(coalesce(utm_id, '')) ~ '^\{\{[^{}]+\}\}$';

UPDATE public.sales
SET
  utm_source = CASE WHEN btrim(coalesce(utm_source, '')) ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(utm_source), '') END,
  utm_medium = CASE WHEN btrim(coalesce(utm_medium, '')) ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(utm_medium), '') END,
  utm_campaign = CASE WHEN btrim(coalesce(utm_campaign, '')) ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(utm_campaign), '') END,
  utm_term = CASE WHEN btrim(coalesce(utm_term, '')) ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(utm_term), '') END,
  utm_content = CASE WHEN btrim(coalesce(utm_content, '')) ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(utm_content), '') END
WHERE btrim(coalesce(utm_source, '')) ~ '^\{\{[^{}]+\}\}$'
   OR btrim(coalesce(utm_medium, '')) ~ '^\{\{[^{}]+\}\}$'
   OR btrim(coalesce(utm_campaign, '')) ~ '^\{\{[^{}]+\}\}$'
   OR btrim(coalesce(utm_term, '')) ~ '^\{\{[^{}]+\}\}$'
   OR btrim(coalesce(utm_content, '')) ~ '^\{\{[^{}]+\}\}$';
